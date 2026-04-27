import { Args, Float, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
  CreateExpenseInput,
  CreateShortcutExpenseInput,
  CreateSubAccountInput,
  EditExpenseInput,
  EditExpenseNoteInput,
  EditWalletBalanceInput,
  TransferBetweenSubAccountsInput,
  TransferResult,
  UpdateSubAccountInput,
} from '../dto/wallet.dto';
import { BadRequestException, NotFoundException, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import { WalletService } from '../services/wallet.service';
import { SubAccountService } from '../services/sub-account.service';
import { ExpenseEntity, ExpenseType, WalletEntity, WalletSubAccount } from 'src/wallet/entities/wallet.entity';
import { User } from 'src/utils/decorators/user.decorator';
import { GetWalletFilters, MonthlyExpenses, WalletStatisticsRange } from '../types/wallet.schemas';
import {
  CacheInterceptor,
  DefaultCacheModule,
  InvalidateCache,
  InvalidateCacheInterceptor,
  UserCache,
} from '../../utils/services/Cache/cache.decorator';
import { CacheService } from 'src/utils/services/Cache/cache.service';
import { ExpensePredictionService } from '../services/expense-prediction.service';
import { ExpenseCorrectionService } from '../services/expense-correction.service';
import { ExpenseService } from '../services/expense.service';
import ModifyResult from 'src/utils/shared/resources/modify-result.resource';

@UseInterceptors(CacheInterceptor, InvalidateCacheInterceptor)
@DefaultCacheModule('Wallet', { invalidateCurrentUser: true })
@UseGuards(AuthGuard)
@Resolver(() => WalletEntity)
export class WalletResolver {
  constructor(
    private readonly walletService: WalletService,
    private readonly subAccountService: SubAccountService,
    private readonly cacheService: CacheService,
    private readonly predictionService: ExpensePredictionService,
    private readonly correctionService: ExpenseCorrectionService,
    private readonly expenseService: ExpenseService,
  ) {}

  @Query((returns) => WalletEntity)
  async wallet(@User() usrId: string) {
    const wallet = await this.walletService.getWalletByUserId(usrId);
    return wallet ? wallet : new NotFoundException('Wallet may not exist');
  }

  @ResolveField(() => [ExpenseEntity])
  async expenses(
    @Parent() wallet: WalletEntity,
    @Args('skip', { type: () => Int, nullable: true }) skip: number = 0,
    @Args('take', { type: () => Int, nullable: true }) take: number = 20,
    @Args('filters', { nullable: true, type: () => GetWalletFilters }) filters: GetWalletFilters,
  ) {
    const cacheKey = `${wallet.userId}:Wallet:expenses:${JSON.stringify({ skip, take, filters })}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await this.walletService.getExpensesByWalletId(wallet.id, {
      pagination: { skip, take },
      where: filters,
      isExactCategory: filters?.isExactCategory,
    });

    await this.cacheService.set(cacheKey, result, 1800);
    return result;
  }

  @ResolveField(() => [MonthlyExpenses])
  async expenses2(
    @Parent() wallet: WalletEntity,
    @Args('skip', { type: () => Int, nullable: true }) skip: number = 0,
    @Args('take', { type: () => Int, nullable: true }) take: number = 6,
    @Args('filters', { nullable: true, type: () => GetWalletFilters }) filters: GetWalletFilters,
  ): Promise<MonthlyExpenses[]> {
    const cacheKey = `${wallet.userId}:Wallet:expenses2:${JSON.stringify({ skip, take, filters })}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached as MonthlyExpenses[];

    const result = await this.walletService.getExpensesGroupedByMonth(wallet.id, {
      monthPagination: { skip, take },
      where: filters,
      isExactCategory: filters?.isExactCategory,
    });

    await this.cacheService.set(cacheKey, result, 1800);
    return result;
  }

  @ResolveField(() => [WalletSubAccount])
  subAccounts(@Parent() wallet: WalletEntity) {
    return this.subAccountService.getAll(wallet.userId);
  }

  @Query(() => Float)
  @UserCache(3600)
  async getMonthTotal(@User() usrId: string, @Args('date') date: string) {
    const parsedDate = new Date(date);
    const [expense, income] = await Promise.all([
      this.walletService.getMonthTotalByType(ExpenseType.expense, usrId, parsedDate.getMonth(), parsedDate.getFullYear()),
      this.walletService.getMonthTotalByType(ExpenseType.income, usrId, parsedDate.getMonth(), parsedDate.getFullYear()),
    ]);
    return income - expense;
  }

  @Query(() => WalletStatisticsRange)
  @UserCache(3600)
  async getStatistics(@User() usrId: string, @Args('range', { type: () => [String, String] }) range: [string, string]) {
    if (range.length !== 2 || new Date(range[0]) > new Date(range[1])) throw new BadRequestException('Invalid range');
    return this.walletService.getStatistics(usrId, range);
  }

  @Mutation((returns) => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  createExpense(
    @User() usrId: string,
    @Args('input', { type: () => CreateExpenseInput }) input: CreateExpenseInput,
  ) {
    return this.walletService.createExpenseFromInput(usrId, input);
  }

  @Mutation((returns) => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createShortcutExpense(
    @User() usrId: string,
    @Args('input', { type: () => CreateShortcutExpenseInput }) input: CreateShortcutExpenseInput,
  ) {
    const { amount, description, latitude, longitude } = input;

    const prediction = await this.predictionService.predictExpense(usrId, description, amount);
    const corrected = await this.correctionService.applyCorrections(usrId, {
      description,
      shop: prediction?.shop ?? null,
      category: prediction?.category ?? 'none',
      amount,
    });

    const expense = await this.walletService.createExpenseFromInput(usrId, {
      amount,
      description: corrected.description,
      type: ExpenseType.expense,
      category: corrected.category ?? prediction?.category ?? 'none',
      shop: corrected.shop ?? prediction?.shop,
      date: new Date().toISOString(),
    } as CreateExpenseInput);

    if (latitude != null && longitude != null) {
      const location =
        (await this.expenseService.findNearbyLocation(latitude, longitude)) ??
        (await this.expenseService.createLocation({
          name: corrected.shop ?? corrected.description,
          kind: 'merchant',
          latitude,
          longitude,
        }));
      await this.expenseService.addExpenseLocation(expense.id, location.id);
      expense.location = location;
    }

    return expense;
  }

  @Mutation(() => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  editExpense(@User() usrId: string, @Args('input', { type: () => EditExpenseInput }) input: EditExpenseInput) {
    return this.walletService.editExpense(input.expenseId, usrId, input);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async editExpenseNote(@Args('input', { type: () => EditExpenseNoteInput }) input: EditExpenseNoteInput) {
    return new ModifyResult(await this.walletService.editExpenseNote(input.expenseId, input.note)).toBoolean();
  }

  @Mutation(() => ID)
  @InvalidateCache({ invalidateCurrentUser: true })
  async deleteExpense(@Args('id', { type: () => ID }) id: string, @User() userId: string) {
    const success = new ModifyResult(await this.walletService.deleteExpense(id, userId)).toBoolean();
    if (!success) throw new NotFoundException('Expense not found or could not be deleted');
    return id;
  }

  @Mutation(() => WalletEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  editWalletBalance(
    @User() usrId: string,
    @Args('input', { type: () => EditWalletBalanceInput }) input: EditWalletBalanceInput,
  ) {
    return this.walletService.editUserWalletBalance(usrId, input);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createWallet(
    @User() user: string,
    @Args('balance', { type: () => Float, nullable: false, defaultValue: 0 }) initialBalance: number,
  ) {
    try {
      return new ModifyResult(await this.walletService.createWallet(user, initialBalance)).toBoolean();
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  @Mutation(() => WalletSubAccount)
  @InvalidateCache({ invalidateCurrentUser: true })
  createSubAccount(
    @User() userId: string,
    @Args('input', { type: () => CreateSubAccountInput }) input: CreateSubAccountInput,
  ) {
    return this.subAccountService.create(userId, input);
  }

  @Mutation(() => WalletSubAccount)
  @InvalidateCache({ invalidateCurrentUser: true })
  updateSubAccount(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateSubAccountInput }) input: UpdateSubAccountInput,
  ) {
    return this.subAccountService.update(id, input);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  deleteSubAccount(@Args('id', { type: () => ID }) id: string) {
    return this.subAccountService.delete(id);
  }

  @Mutation(() => TransferResult)
  @InvalidateCache({ invalidateCurrentUser: true })
  transferBetweenSubAccounts(
    @Args('input', { type: () => TransferBetweenSubAccountsInput }) input: TransferBetweenSubAccountsInput,
  ) {
    return this.subAccountService.transfer(input.fromId, input.toId, input.amount);
  }
}

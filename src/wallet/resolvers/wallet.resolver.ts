import { Args, Float, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
  CreateExpenseInput,
  CreateShortcutExpenseInput,
  EditExpenseInput,
  EditExpenseNoteInput,
  EditWalletBalanceInput,
  TransferBetweenSubAccountsInput,
} from '../dto/wallet.dto';
import { BadRequestException, NotFoundException, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import { WalletService } from '../services/wallet.service';
import {
  CreateSubAccountInput,
  ExpenseEntity,
  ExpenseType,
  TransferResult,
  UpdateSubAccountInput,
  WalletEntity,
  WalletSubAccount,
} from 'src/wallet/entities/wallet.entity';
import { User } from 'src/utils/decorators/user.decorator';
import { GetWalletFilters, MonthlyExpenses, WalletStatisticsRange } from '../types/wallet.schemas';
import { SubscriptionService } from '../services/subscriptions.service';
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
    private walletService: WalletService,
    private subscriptionService: SubscriptionService,

    private cacheService: CacheService,

    private predictionService: ExpensePredictionService,
    private correctionService: ExpenseCorrectionService,
    private expenseService: ExpenseService,
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
    @Args('filters', { nullable: true, type: () => GetWalletFilters })
    filters: GetWalletFilters,
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
    @Args('filters', { nullable: true, type: () => GetWalletFilters })
    filters: GetWalletFilters,
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

  @Mutation((returns) => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createExpense(
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
    const categoryPrediction = await this.predictionService.predictExpense(usrId, description, amount);

    const predictedCategory = categoryPrediction ? categoryPrediction.category : 'none';
    const predictedShop = categoryPrediction?.shop ?? null;

    const corrected = await this.correctionService.applyCorrections(usrId, {
      description,
      shop: predictedShop,
      category: predictedCategory,
      amount,
    });

    const expense = await this.walletService.createExpense(
      usrId,
      amount,
      corrected.description,
      ExpenseType.expense,
      corrected.category ?? predictedCategory,
      new Date(),
      false,
      null,
      0,
      corrected.shop ?? predictedShop,
    );

    if (latitude != null && longitude != null) {
      const existing = await this.expenseService.findNearbyLocation(latitude, longitude);
      const location =
        existing ??
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

  @Mutation(() => ID)
  @InvalidateCache({ invalidateCurrentUser: true })
  async deleteExpense(@Args('id', { type: () => ID }) id: string, @User() userId: string) {
    const success = new ModifyResult(await this.walletService.deleteExpense(id, userId)).toBoolean();

    if (!success) {
      throw new NotFoundException('Expense not found or could not be deleted');
    }

    return id;
  }

  @Mutation(() => WalletEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async editWalletBalance(
    @User() usrId: string,
    @Args('input', { type: () => EditWalletBalanceInput }) input: EditWalletBalanceInput,
  ) {
    return await this.walletService.editUserWalletBalance(usrId, input);
  }

  @Mutation(() => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async editExpense(@User() usrId: string, @Args('input', { type: () => EditExpenseInput }) input: EditExpenseInput) {
    const result = await this.walletService.editExpense(input.expenseId, usrId, input);

    return result;
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async editExpenseNote(@Args('input', { type: () => EditExpenseNoteInput }) input: EditExpenseNoteInput) {
    return new ModifyResult(await this.walletService.editExpenseNote(input.expenseId, input.note)).toBoolean();
  }

  @ResolveField(() => [WalletSubAccount])
  subAccounts(@Parent() wallet: WalletEntity) {
    return this.walletService.getSubAccounts(wallet.userId);
  }

  @Mutation(() => WalletSubAccount)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createSubAccount(
    @User() userId: string,
    @Args('input', { type: () => CreateSubAccountInput }) input: CreateSubAccountInput,
  ) {
    return this.walletService.createSubAccount(userId, input);
  }

  @Mutation(() => WalletSubAccount)
  @InvalidateCache({ invalidateCurrentUser: true })
  updateSubAccount(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateSubAccountInput }) input: UpdateSubAccountInput,
  ) {
    return this.walletService.updateSubAccount(id, input);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  deleteSubAccount(@Args('id', { type: () => ID }) id: string) {
    return this.walletService.deleteSubAccount(id);
  }

  @Mutation(() => TransferResult)
  @InvalidateCache({ invalidateCurrentUser: true })
  transferBetweenSubAccounts(
    @Args('input', { type: () => TransferBetweenSubAccountsInput }) input: TransferBetweenSubAccountsInput,
  ) {
    return this.walletService.transferBetweenSubAccounts(input.fromId, input.toId, input.amount);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createWallet(
    @User() user: string,
    @Args('balance', { type: () => Float, nullable: false, defaultValue: 0 })
    initialBalance: number,
  ) {
    try {
      return new ModifyResult(await this.walletService.createWallet(user, initialBalance)).toBoolean();
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  @Query(() => Float)
  @UserCache(3600)
  async getMonthTotal(@User() usrId: string, @Args('date') date: string) {
    const parsedDate = new Date(date);

    const expenses = this.walletService.getMonthTotalByType(
      ExpenseType.expense,
      usrId,
      parsedDate.getMonth(),
      parsedDate.getFullYear(),
    );

    const incomes = this.walletService.getMonthTotalByType(
      ExpenseType.income,
      usrId,
      parsedDate.getMonth(),
      parsedDate.getFullYear(),
    );

    const promise = await Promise.all([expenses, incomes]);

    return promise[1] - promise[0];
  }

  @Query(() => WalletStatisticsRange)
  @UserCache(3600)
  async getStatistics(@User() usrId: string, @Args('range', { type: () => [String, String] }) range: [string, string]) {
    if (range.length !== 2) {
      throw new BadRequestException('Invalid range');
    }

    if (new Date(range[0]) > new Date(range[1])) {
      throw new BadRequestException('Invalid range');
    }

    return await this.walletService.getStatistics(usrId, range);
  }
}

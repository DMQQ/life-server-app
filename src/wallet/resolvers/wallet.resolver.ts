import { Args, Float, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
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
import { BillingCycleEnum } from '../entities/subscription.entity';
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
import { Model } from 'src/utils/decorators/model.decorator';

const parseDate = (dateString: string) => {
  const currentTime = new Date();
  const inputDate = new Date(dateString);

  return new Date(
    inputDate.getFullYear(),
    inputDate.getMonth(),
    inputDate.getDate(),
    currentTime.getHours(),
    currentTime.getMinutes(),
    currentTime.getSeconds(),
    currentTime.getMilliseconds(),
  );
};

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

    const grouped = await this.walletService.getExpensesGroupedByMonth(wallet.id, {
      monthPagination: { skip, take },
      where: filters,
      isExactCategory: filters?.isExactCategory,
    });

    const result: MonthlyExpenses[] = grouped.map(({ month, expenses }) => {
      const flow = expenses.reduce(
        (acc, e) => {
          if (e.type === 'income') acc.income += e.amount;
          else if (e.type === 'expense') acc.expense += e.amount;
          return acc;
        },
        { income: 0, expense: 0 },
      );
      return { month, flow, expenses };
    });

    await this.cacheService.set(cacheKey, result, 1800);
    return result;
  }

  @Mutation((returns) => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createExpense(
    @User() usrId: string,
    @Args('amount', { type: () => Float }) amount: number,
    @Args('description') description: string,
    @Args('type', { type: () => String }) type: ExpenseType,
    @Args('category', { type: () => String }) category: string,
    @Args('date') date: string,
    @Args('schedule', { type: () => Boolean, nullable: true }) schedule = false,
    @Args('isSubscription', {
      type: () => Boolean,
      nullable: true,
      defaultValue: false,
    })
    isSubscription: boolean,

    @Args('spontaneousRate', { type: () => Float, nullable: true })
    spontaneousRate: number,
    @Args('subAccountId', { type: () => ID, nullable: true })
    subAccountId?: string,
  ) {
    const parsedDate = parseDate(date || new Date().toISOString().split('T')[0]);

    const walletId = await this.walletService.findWalletId(usrId);

    let subscription = null;

    if (isSubscription)
      subscription = await this.subscriptionService.insert({
        amount: amount,
        dateStart: parsedDate,
        dateEnd: null,
        description: description,
        isActive: true,
        billingCycle: BillingCycleEnum.MONTHLY,
        nextBillingDate: this.subscriptionService.getNextBillingDate({
          billingCycle: BillingCycleEnum.MONTHLY,
          nextBillingDate: parsedDate,
        }),
        walletId: walletId.id,
      });

    const expense = await this.walletService.createExpense(
      usrId,
      amount,
      description,
      type,
      category,
      parsedDate,
      schedule,
      subscription ? subscription.id : null,
      spontaneousRate,
      undefined,
      subAccountId,
    );

    return expense;
  }

  @Mutation((returns) => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createShortcutExpense(
    @User() usrId: string,
    @Args('amount', { type: () => Float }) amount: number,
    @Args('description') description: string,
    @Args('latitude', { type: () => Float, nullable: true }) latitude?: number,
    @Args('longitude', { type: () => Float, nullable: true }) longitude?: number,
  ) {
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
    await this.walletService.deleteExpense(id, userId);

    return id;
  }

  @Mutation(() => WalletEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async editWalletBalance(
    @User() usrId: string,
    @Args('amount', { type: () => Int, nullable: true }) amount: number,
    @Args('paycheck', { type: () => Float, nullable: true }) paycheck: number,
    @Args('paycheckDate', { type: () => String, nullable: true }) paycheckDate: string,
  ) {
    return await this.walletService.editUserWalletBalance(usrId, {
      amount,
      paycheck,
      paycheckDate,
    });
  }

  @Mutation(() => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async editExpense(
    @User() usrId: string,
    @Args('expenseId', { type: () => ID }) expenseId: string,
    @Args('amount', { type: () => Float }) amount: number,
    @Args('description') description: string,
    @Args('type', { type: () => String }) type: ExpenseType,
    @Args('category', { type: () => String }) category: string,
    @Args('date') date: string,
    @Args('spontaneousRate', { type: () => Float, nullable: true }) spontaneousRate: number,
    @Args('subAccountId', { type: () => ID, nullable: true }) subAccountId?: string,
  ) {
    const result = await this.walletService.editExpense(expenseId, usrId, {
      amount,
      description,
      type,
      category,
      date: new Date(date),
      spontaneousRate: spontaneousRate ?? 0,
      subAccountId,
    });

    return result;
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
    const response = await this.walletService.createSubAccount(userId, input);

    console.log('Created sub-account:', response);

    return response;
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
    @Args('fromId', { type: () => ID }) fromId: string,
    @Args('toId', { type: () => ID }) toId: string,
    @Args('amount', { type: () => Float }) amount: number,
  ) {
    return this.walletService.transferBetweenSubAccounts(fromId, toId, amount);
  }

  @Query(() => Float)
  @UserCache(3600)
  async getMonthTotalExpenses(@User() usrId: string) {
    return await this.walletService.getMonthTotalByType(
      'expense',
      usrId,
      new Date().getMonth(),
      new Date().getFullYear(),
    );
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createWallet(
    @User() user: string,
    @Args('balance', { type: () => Float, nullable: false, defaultValue: 0 })
    initialBalance: number,
  ) {
    try {
      await this.walletService.createWallet(user, initialBalance);

      return true;
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

    const stats = await this.walletService.getStatistics(usrId, range);

    return stats[0];
  }
}

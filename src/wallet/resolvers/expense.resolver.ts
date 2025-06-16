import { Args, Float, Mutation, Parent, ResolveField, Resolver, Query, ID } from '@nestjs/graphql';
import { ExpenseEntity, ExpenseLocationEntity, ExpenseSubExpense } from '../entities//wallet.entity';
import { SubscriptionService } from '../services/subscriptions.service';
import { SubscriptionEntity } from '../entities/subscription.entity';
import { ExpenseService } from '../services/expense.service';
import { User } from 'src/utils/decorators/user.decorator';
import { ExpensePredictionType } from '../types/wallet.schemas';
import { ExpensePredictionService } from '../services/expense-prediction.service';
import {
  CacheInterceptor,
  DefaultCacheModule,
  InvalidateCache,
  InvalidateCacheInterceptor,
  UserCache,
} from '../../utils/services/Cache/cache.decorator';
import { UseInterceptors } from '@nestjs/common';
import {
  CreateLocationDto,
  CreateSubExpenseDto,
  HourlyStats,
  MonthlyCategoryComparisonOutput,
  MonthlyHeatMap,
  UpdateSubExpenseDto,
} from '../types/expense.schemas';

@UseInterceptors(CacheInterceptor, InvalidateCacheInterceptor)
@DefaultCacheModule('Wallet', { invalidateCurrentUser: true })
@Resolver(() => ExpenseEntity)
export class ExpenseResolver {
  constructor(
    private subscriptionService: SubscriptionService,
    private expenseService: ExpenseService,

    private expensePredictionService: ExpensePredictionService,
  ) {}

  @Query(() => ExpenseEntity)
  @UserCache(3600)
  expense(@Args('expenseId', { type: () => ID, nullable: false }) expenseId: string) {
    return this.expenseService.getOne(expenseId);
  }

  @ResolveField('subscription', () => SubscriptionEntity, { nullable: true })
  async getSubscription(@Parent() { subscriptionId }: ExpenseEntity) {
    if (!subscriptionId) return null;

    try {
      const subscription = await this.subscriptionService.getSubscriptionById(subscriptionId);

      return subscription;
    } catch (error) {
      return null;
    }
  }

  @ResolveField('subexpenses', () => [ExpenseSubExpense])
  async getSubExpenses(@Parent() expense: ExpenseEntity) {
    return this.expenseService.getSubExpenses(expense.id);
  }

  @Mutation(() => ExpenseLocationEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  createLocation(
    @Args('input', { type: () => CreateLocationDto }) input: CreateLocationDto,
  ): Promise<ExpenseLocationEntity> {
    return this.expenseService.createLocation(input);
  }

  @Query(() => [ExpenseLocationEntity])
  @UserCache(3600)
  locations(
    @Args('query', { nullable: true }) query: string,
    @Args('latitude', { type: () => Float, nullable: true }) latitude: number,
    @Args('longitude', { type: () => Float, nullable: true }) longitude: number,
  ) {
    return this.expenseService.queryLocations(query, longitude, latitude);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async addExpenseLocation(
    @Args('expenseId', { type: () => ID, nullable: false }) expenseId: string,
    @Args('locationId', { type: () => ID, nullable: false }) locationId: string,
  ) {
    return !!((await this.expenseService.addExpenseLocation(expenseId, locationId)).affected > 0);
  }

  @Mutation(() => ExpenseSubExpense)
  @InvalidateCache({ invalidateCurrentUser: true })
  createSubExpense(
    @Args('expenseId', { type: () => ID }) expenseId: string,
    @Args('input', { type: () => CreateSubExpenseDto })
    input: CreateSubExpenseDto,
  ) {
    return this.expenseService.createSubExpense(expenseId, input);
  }

  @Mutation(() => [ExpenseSubExpense])
  @InvalidateCache({ invalidateCurrentUser: true })
  addMultipleSubExpenses(
    @Args('expenseId', { type: () => ID }) expenseId: string,
    @Args('inputs', { type: () => [CreateSubExpenseDto] })
    inputs: CreateSubExpenseDto[],
  ) {
    return this.expenseService.addMultipleSubExpenses(expenseId, inputs);
  }

  @Mutation(() => ExpenseSubExpense)
  @InvalidateCache({ invalidateCurrentUser: true })
  updateSubExpense(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateSubExpenseDto })
    input: UpdateSubExpenseDto,
  ) {
    return this.expenseService.updateSubExpense(id, input);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async deleteSubExpense(@Args('id', { type: () => ID }) id: string) {
    const result = await this.expenseService.deleteSubExpense(id);
    return result.success;
  }

  @Query(() => [ExpenseSubExpense])
  @UserCache(3600)
  subExpenses(@Args('expenseId', { type: () => ID }) expenseId: string) {
    return this.expenseService.getSubExpenses(expenseId);
  }

  @Query(() => ExpenseSubExpense, { nullable: true })
  @UserCache(3600)
  subExpense(@Args('id', { type: () => ID }) id: string) {
    return this.expenseService.getSubExpenseById(id);
  }

  @Query(() => ExpenseEntity)
  @UserCache(3600)
  expenseWithSubExpenses(@Args('expenseId', { type: () => ID }) expenseId: string) {
    return this.expenseService.getExpenseWithSubExpenses(expenseId);
  }

  @Query(() => [MonthlyCategoryComparisonOutput])
  @UserCache(3600)
  async monthlyCategoryComparison(
    @User() userId: string,
    // months in date format YYYY-MM-DD
    @Args('months', { type: () => [String], nullable: false }) months: string[],
  ) {
    const response = await this.expenseService.monthlyCategoryComparison(userId, months);

    return response;
  }

  @Query(() => [MonthlyHeatMap])
  @UserCache(3600)
  async monthlyDateSpendings(
    @User() userId: string,
    // months in date format YYYY-MM-DD
    @Args('months', { type: () => [String], nullable: false }) months: string[],
  ) {
    const response = await this.expenseService.monthlyHeatMapSpendings(userId, months);

    return response;
  }

  @Query(() => [HourlyStats])
  @UserCache(3600)
  async hourlySpendingsHeatMap(
    @User() userId: string,
    @Args('months', { type: () => [String], nullable: false }) months: string[],
  ) {
    const response = await this.expenseService.hourlyHeadMapSpendings(userId, months);

    return response;
  }

  @Query(() => ExpensePredictionType, { nullable: true })
  async predictExpense(
    @User() user: string,
    @Args('input') input: string,
    @Args('amount', { nullable: true }) amount?: number,
  ) {
    return this.expensePredictionService.predictExpense(user, input, amount);
  }

  @Query(() => [SubscriptionEntity])
  @UserCache(3600)
  subscriptions(@User() userId: string) {
    return this.subscriptionService.getSubscriptions(userId);
  }

  // @Mutation(() => SubscriptionEntity)
  // async modifySubscription(@Args('input') input: SubscriptionEntity) {}
}

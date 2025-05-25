import {
  Args,
  Field,
  Float,
  InputType,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
  Query,
  ID,
  ObjectType,
  Int,
} from '@nestjs/graphql';
import { ExpenseEntity, ExpenseLocationEntity, ExpenseSubExpense } from './wallet.entity';
import { SubscriptionService } from './subscriptions.service';
import { SubscriptionEntity } from './subscription.entity';
import { ExpenseService } from './expense.service';
import { User } from 'src/utils/decorators/User';
import { ExpensePredictionType } from './wallet.schemas';
import { ExpensePredictionService } from './expense-prediction.service';

@InputType()
class CreateLocationDto {
  @Field(() => Float)
  longitude: number;

  @Field(() => Float)
  latitude: number;

  @Field()
  name: string;

  @Field()
  kind: string;
}

@InputType()
class CreateSubExpenseDto {
  @Field()
  description: string;

  @Field(() => Float)
  amount: number;

  @Field()
  category: string;
}

@InputType()
class UpdateSubExpenseDto {
  @Field({ nullable: true })
  description?: string;

  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field({ nullable: true })
  category?: string;
}

@ObjectType()
class MonthlyCategoryComparisonItem {
  @Field(() => String)
  category: string;

  @Field(() => Float)
  total: number;

  @Field(() => Float)
  avg: number;

  @Field(() => Float)
  count: number;
}

@ObjectType()
class MonthlyCategoryComparisonOutput {
  @Field({ nullable: true })
  month: string;

  @Field(() => [MonthlyCategoryComparisonItem], { nullable: true })
  categories: MonthlyCategoryComparisonItem[];
}

@ObjectType()
class MonthlyHeatMap {
  @Field(() => Int)
  dayOfMonth: number;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => Float)
  averageAmount: number;
}

@ObjectType()
class HourlyStats {
  @Field(() => Number)
  hour: number;

  @Field(() => Number)
  count: number;

  @Field(() => Float)
  avg_amount: number;

  @Field(() => Float)
  min_amount: number;

  @Field(() => Float)
  max_amount: number;

  @Field(() => Float)
  std_deviation: number;

  @Field(() => Float)
  variance: number;
}

@Resolver(() => ExpenseEntity)
export class ExpenseResolver {
  constructor(
    private subscriptionService: SubscriptionService,
    private expenseService: ExpenseService,

    private expensePredictionService: ExpensePredictionService,
  ) {}

  @Query(() => ExpenseEntity)
  expense(@Args('expenseId', { type: () => ID, nullable: false }) expenseId: string) {
    return this.expenseService.getOne(expenseId);
  }

  @ResolveField('subscription', () => SubscriptionEntity, { nullable: true })
  async getSubscription(@Parent() expense: ExpenseEntity) {
    const { subscriptionId } = expense;

    if (!subscriptionId) {
      return null;
    }

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
  createLocation(
    @Args('input', { type: () => CreateLocationDto }) input: CreateLocationDto,
  ): Promise<ExpenseLocationEntity> {
    return this.expenseService.createLocation(input);
  }

  @Query(() => [ExpenseLocationEntity])
  locations(
    @Args('query', { nullable: true }) query: string,
    @Args('latitude', { type: () => Float, nullable: true }) latitude: number,
    @Args('longitude', { type: () => Float, nullable: true }) longitude: number,
  ) {
    return this.expenseService.queryLocations(query, longitude, latitude);
  }

  @Mutation(() => Boolean)
  async addExpenseLocation(
    @Args('expenseId', { type: () => ID, nullable: false }) expenseId: string,
    @Args('locationId', { type: () => ID, nullable: false }) locationId: string,
  ) {
    return !!((await this.expenseService.addExpenseLocation(expenseId, locationId)).affected > 0);
  }

  @Mutation(() => ExpenseSubExpense)
  createSubExpense(
    @Args('expenseId', { type: () => ID }) expenseId: string,
    @Args('input', { type: () => CreateSubExpenseDto })
    input: CreateSubExpenseDto,
  ) {
    return this.expenseService.createSubExpense(expenseId, input);
  }

  @Mutation(() => [ExpenseSubExpense])
  addMultipleSubExpenses(
    @Args('expenseId', { type: () => ID }) expenseId: string,
    @Args('inputs', { type: () => [CreateSubExpenseDto] })
    inputs: CreateSubExpenseDto[],
  ) {
    console.log('expenseId', expenseId);
    return this.expenseService.addMultipleSubExpenses(expenseId, inputs);
  }

  @Mutation(() => ExpenseSubExpense)
  updateSubExpense(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateSubExpenseDto })
    input: UpdateSubExpenseDto,
  ) {
    return this.expenseService.updateSubExpense(id, input);
  }

  @Mutation(() => Boolean)
  async deleteSubExpense(@Args('id', { type: () => ID }) id: string) {
    const result = await this.expenseService.deleteSubExpense(id);
    return result.success;
  }

  @Query(() => [ExpenseSubExpense])
  subExpenses(@Args('expenseId', { type: () => ID }) expenseId: string) {
    return this.expenseService.getSubExpenses(expenseId);
  }

  @Query(() => ExpenseSubExpense, { nullable: true })
  subExpense(@Args('id', { type: () => ID }) id: string) {
    return this.expenseService.getSubExpenseById(id);
  }

  @Query(() => ExpenseEntity)
  expenseWithSubExpenses(@Args('expenseId', { type: () => ID }) expenseId: string) {
    return this.expenseService.getExpenseWithSubExpenses(expenseId);
  }

  @Query(() => [MonthlyCategoryComparisonOutput])
  async monthlyCategoryComparison(
    @User() userId: string,
    // months in date format YYYY-MM-DD
    @Args('months', { type: () => [String], nullable: false }) months: string[],
  ) {
    const response = await this.expenseService.monthlyCategoryComparison(userId, months);

    return response;
  }

  @Query(() => [MonthlyHeatMap])
  async monthlyDateSpendings(
    @User() userId: string,
    // months in date format YYYY-MM-DD
    @Args('months', { type: () => [String], nullable: false }) months: string[],
  ) {
    const response = await this.expenseService.monthlyHeatMapSpendings(userId, months);

    return response;
  }

  @Query(() => [HourlyStats])
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
  subscription(@User() userId: string) {
    return this.subscriptionService.getSubscriptions(userId);
  }

  // @Mutation(() => SubscriptionEntity)
  // async modifySubscription(@Args('input') input: SubscriptionEntity) {}
}

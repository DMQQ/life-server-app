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
} from '@nestjs/graphql';
import {
  ExpenseEntity,
  ExpenseLocationEntity,
  ExpenseSubExpense,
} from './wallet.entity';
import { SubscriptionService } from './subscriptions.service';
import { SubscriptionEntity } from './subscription.entity';
import { ExpenseService } from './expense.service';

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

@Resolver(() => ExpenseEntity)
export class ExpenseResolver {
  constructor(
    private subscriptionService: SubscriptionService,
    private expenseService: ExpenseService,
  ) {}

  @ResolveField('subscription', () => SubscriptionEntity, { nullable: true })
  async getSubscription(@Parent() expense: ExpenseEntity) {
    const { subscriptionId } = expense;

    if (!subscriptionId) {
      return null;
    }

    try {
      const subscription = await this.subscriptionService.getSubscriptionById(
        subscriptionId,
      );

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
    return !!(
      (await this.expenseService.addExpenseLocation(expenseId, locationId))
        .affected > 0
    );
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
  expenseWithSubExpenses(
    @Args('expenseId', { type: () => ID }) expenseId: string,
  ) {
    return this.expenseService.getExpenseWithSubExpenses(expenseId);
  }
}

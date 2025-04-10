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
import { ExpenseEntity, ExpenseLocationEntity } from './wallet.entity';
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
}

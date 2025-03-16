import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ExpenseEntity } from './wallet.entity';
import { SubscriptionService } from './subscriptions.service';
import { SubscriptionEntity } from './subscription.entity';

@Resolver(() => ExpenseEntity)
export class ExpenseResolver {
  constructor(private subscriptionService: SubscriptionService) {}

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
}

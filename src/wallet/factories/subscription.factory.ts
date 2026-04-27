import { BillingCycleEnum, SubscriptionEntity } from '../entities/subscription.entity';
import { CreateSubscriptionInput } from '../types/subscription.schemas';
import { SubscriptionBillingUtils } from '../utils/subscription-billing.util';

export default class SubscriptionFactory {
  static create(input: Partial<CreateSubscriptionInput>): SubscriptionEntity {
    const subscription = new SubscriptionEntity();
    subscription.amount = input.amount;
    subscription.dateStart = new Date(input.dateStart);
    subscription.dateEnd = null;
    subscription.description = input.description;
    subscription.isActive = true;
    subscription.billingCycle = input.billingCycle || BillingCycleEnum.MONTHLY;
    subscription.nextBillingDate = SubscriptionBillingUtils.getNextBillingDate(subscription);
    return subscription;
  }
}

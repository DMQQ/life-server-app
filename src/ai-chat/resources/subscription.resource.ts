import { SubscriptionEntity } from 'src/wallet/entities/subscription.entity';

export class SubscriptionResource {
  static toWidgetPayload(e: SubscriptionEntity) {
    return {
      id: e.id,
      description: e.description,
      amount: e.amount,
      billingCycle: e.billingCycle,
      nextBillingDate: e.nextBillingDate,
      isActive: e.isActive,
      dateStart: e.dateStart,
      dateEnd: e.dateEnd,
    };
  }

  static toAiContext(e: SubscriptionEntity) {
    return {
      id: e.id,
      description: e.description,
      amount: e.amount,
      billingCycle: e.billingCycle,
      isActive: e.isActive,
    };
  }
}

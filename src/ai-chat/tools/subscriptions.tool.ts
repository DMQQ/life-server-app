import { SubscriptionEntity } from 'src/wallet/entities/subscription.entity';
import { AiTool, buildStandardQuery, ToolContext, UniversalQueryParams } from './base.tool';

const FIELD_MAP: Record<string, string> = {
  id: 's.id',
  amount: 's.amount',
  description: 's.description',
  billingCycle: 's.billingCycle',
  isActive: 's.isActive',
  dateStart: 's.dateStart',
  dateEnd: 's.dateEnd',
  nextBillingDate: 's.nextBillingDate',
};

export class SubscriptionsTool extends AiTool {
  readonly name = 'subscriptions';
  readonly description = 'Recurring subscription payments';
  readonly fields = {
    id: 'UUID',
    amount: 'number PLN',
    description: 'string',
    billingCycle: '"daily" | "weekly" | "monthly" | "yearly"',
    isActive: 'boolean',
    dateStart: 'timestamp',
    nextBillingDate: 'timestamp',
  };

  async run(params: UniversalQueryParams, ctx: ToolContext) {
    const qb = ctx.dataSource
      .createQueryBuilder(SubscriptionEntity, 's')
      .where('s.walletId = :walletId', { walletId: ctx.walletId });

    return buildStandardQuery(qb, params, FIELD_MAP).getRawMany();
  }
}

import { SubscriptionEntity } from 'src/wallet/entities/subscription.entity';
import { AiTool, buildStandardQuery, ToolContext, UniversalQueryParams } from './base.tool';
import { z } from 'zod';

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
  readonly description = `Recurring subscription payments.
CRITICAL DATE RULE: The date fields (dateStart, nextBillingDate) contain full timestamps. 
If the user asks for a specific single day, NEVER use the 'eq' operator. 
ALWAYS use the 'between' operator spanning from 00:00:00 to 23:59:59 of that day.`;

  get zodSchema() {
    return z.object({
      where: z
        .object({
          isActive: z
            .object({
              eq: z.boolean().nullish(),
            })
            .nullish(),
          billingCycle: z
            .object({
              eq: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullish(),
            })
            .nullish(),
          nextBillingDate: z
            .object({
              between: z.array(z.string()).nullish(),
              gt: z.string().nullish(),
              lt: z.string().nullish(),
            })
            .nullish(),
        })
        .nullish(),
      orderBy: z
        .object({
          field: z.enum(['amount', 'nextBillingDate', 'dateStart']),
          direction: z.enum(['asc', 'desc']),
        })
        .nullish(),
      limit: z.number().max(100).nullish(),
    });
  }

  async run(params: UniversalQueryParams, ctx: ToolContext) {
    const qb = ctx.dataSource
      .createQueryBuilder(SubscriptionEntity, 's')
      .where('s.walletId = :walletId', { walletId: ctx.walletId });

    return buildStandardQuery(qb, params, FIELD_MAP).getRawMany();
  }
}

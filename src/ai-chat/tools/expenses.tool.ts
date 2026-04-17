import { ExpenseEntity } from 'src/wallet/entities/wallet.entity';
import { AiTool, buildStandardQuery, ToolContext, UniversalQueryParams } from './base.tool';
import { EXPENSE_CATEGORIES } from 'src/utils/shared/AI/constants';
import { z } from 'zod';

const FIELD_MAP: Record<string, string> = {
  id: 'e.id',
  amount: 'e.amount',
  category: 'e.category',
  description: 'e.description',
  date: 'e.date',
  type: 'e.type',
};

export class ExpensesTool extends AiTool {
  readonly name = 'expenses';

  readonly description = `Expense and income transactions. 
CRITICAL DATE RULE: The 'date' field contains full timestamps in the database. 
If the user asks for a specific single day (e.g., "dzisiaj", "wczoraj"), NEVER use the 'eq' operator. 
ALWAYS use the 'between' operator spanning from 00:00:00 to 23:59:59 of that day.`;

  readonly fields = {
    id: 'UUID',
    amount: 'number PLN',
    category: `string e.g. ${EXPENSE_CATEGORIES}`,
    description: 'string',
    date: 'YYYY-MM-DD',
    type: '"expense" | "income"',
  };

  get zodSchema() {
    return z.object({
      where: z
        .object({
          date: z
            .object({
              between: z.array(z.string()).nullish(),
              eq: z.string().nullish(),
              gt: z.string().nullish(),
              gte: z.string().nullish(),
              lt: z.string().nullish(),
              lte: z.string().nullish(),
            })
            .nullish(),
          category: z
            .object({
              eq: z.string().nullish(),
              in: z.array(z.string()).nullish(),
              like: z.string().nullish(),
            })
            .nullish(),
          type: z
            .object({
              eq: z.enum(['expense', 'income']).nullish(),
            })
            .nullish(),
          amount: z
            .object({
              eq: z.number().nullish(),
              gt: z.number().nullish(),
              lt: z.number().nullish(),
              gte: z.number().nullish(),
              lte: z.number().nullish(),
            })
            .nullish(),
        })
        .nullish(),
      orderBy: z
        .object({
          field: z.enum(['date', 'amount', 'category', 'type']),
          direction: z.enum(['asc', 'desc']),
        })
        .nullish(),
      limit: z.number().max(100).nullish(),
    });
  }

  async run(params: UniversalQueryParams, ctx: ToolContext) {
    const qb = ctx.dataSource
      .createQueryBuilder(ExpenseEntity, 'e')
      .where('e.walletId = :walletId', { walletId: ctx.walletId });

    return buildStandardQuery(qb, params, FIELD_MAP).getRawMany();
  }
}

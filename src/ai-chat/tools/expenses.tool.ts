import { ExpenseEntity } from 'src/wallet/entities/wallet.entity';
import { AiTool, buildStandardQuery, ToolContext, UniversalQueryParams } from './base.tool';
import { EXPENSE_CATEGORIES } from 'src/utils/shared/AI/constants';

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
  readonly description = `
    Expense and income transactions
    Fetches user expenses. 
    CRITICAL DATE RULE: The 'date' field contains full timestamps (e.g., YYYY-MM-DDTHH:mm:ss.SSSZ). 
    If the user asks for expenses from a specific single day (e.g., "today" or "yesterday"), NEVER use the 'eq' operator. 
    ALWAYS use the 'between' operator spanning from the start to the end of that day. 
    Example for a single day: "where": { "date": { "between": ["2026-04-15T00:00:00", "2026-04-15T23:59:59"] } }
  `;
  
  readonly fields = {
    id: 'UUID',
    amount: 'number PLN',
    category: `string e.g. ${EXPENSE_CATEGORIES}`,
    description: 'string',
    date: 'YYYY-MM-DD',
    type: '"expense" | "income"',
  };

  async run(params: UniversalQueryParams, ctx: ToolContext) {
    const qb = ctx.dataSource
      .createQueryBuilder(ExpenseEntity, 'e')
      .where('e.walletId = :walletId', { walletId: ctx.walletId });

    return buildStandardQuery(qb, params, FIELD_MAP).getRawMany();
  }
}

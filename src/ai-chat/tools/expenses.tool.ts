import { ExpenseEntity } from 'src/wallet/entities/wallet.entity';
import { AiTool, buildStandardQuery, ToolContext, UniversalQueryParams } from './base.tool';

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
  readonly description = 'Expense and income transactions';
  readonly fields = {
    id: 'UUID',
    amount: 'number PLN',
    category: 'string e.g. "food:restaurant"',
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

import { ExpenseEntity } from 'src/wallet/entities/wallet.entity';

export class ExpenseResource {
  static toWidgetPayload(e: ExpenseEntity) {
    return {
      id: e.id,
      amount: e.amount,
      description: e.description,
      date: e.date,
      type: e.type,
      category: e.category,
      shop: e.shop,
      note: e.note,
      tags: e.tags,
    };
  }

  static toAiContext(e: ExpenseEntity) {
    return {
      id: e.id,
      amount: e.amount,
      date: e.date,
      type: e.type,
      category: e.category,
    };
  }
}

import {
  ExpenseEntity,
  ExpenseType,
  ExpenseLocationEntity,
  ExpenseSubExpense,
  ExpenseFileEntity,
} from '../entities/wallet.entity';

type ExpenseRelations = 'id' | 'wallet' | 'files' | 'subscription' | 'location' | 'subexpenses' | 'subAccount';

type ExpenseData =
  Pick<ExpenseEntity, 'amount' | 'description' | 'walletId'> &
  Partial<Omit<ExpenseEntity, ExpenseRelations | 'amount' | 'description' | 'walletId' | 'date'>> &
  { date?: Date | string };

export class ExpenseFactory {
  static createExpense(data: ExpenseData): ExpenseEntity {
    return Object.assign(new ExpenseEntity(), {
      type: ExpenseType.expense,
      category: 'none',
      schedule: false,
      spontaneousRate: 0,
      ...data,
      date: data.date ? new Date(data.date) : new Date(),
    });
  }

  static createIncomeExpense(data: Omit<ExpenseData, 'type' | 'schedule'>): ExpenseEntity {
    return this.createExpense({ category: 'income', ...data, type: ExpenseType.income });
  }

  static createScheduledExpense(data: Omit<ExpenseData, 'schedule'>): ExpenseEntity {
    return this.createExpense({ ...data, schedule: true });
  }

  static createSubscriptionExpense(data: Omit<ExpenseData, 'type'>): ExpenseEntity {
    return this.createExpense({ category: 'subscription', ...data, type: ExpenseType.expense });
  }

  static createTransferExpense(data: {
    walletId: string;
    amount: number;
    fromName: string;
    toName: string;
    subAccountId: string;
    balanceBeforeInteraction?: number;
  }): ExpenseEntity {
    return this.createExpense({
      amount: 0,
      description: `Transfer ${data.amount} ${data.fromName} -> ${data.toName}`,
      walletId: data.walletId,
      type: ExpenseType.income,
      category: 'edit',
      balanceBeforeInteraction: data.balanceBeforeInteraction,
      subAccountId: data.subAccountId,
    });
  }

  static createBalanceEditExpense(data: {
    newBalance: number;
    walletId: string;
    currentBalance: number;
    subAccountId?: string;
  }): ExpenseEntity {
    return this.createExpense({
      amount: 0,
      description: `Balance edited to ${data.newBalance}`,
      walletId: data.walletId,
      type: ExpenseType.income,
      category: 'edit',
      balanceBeforeInteraction: data.currentBalance,
      subAccountId: data.subAccountId,
    });
  }

  static createExpenseFromPrediction(
    prediction: { merchant: string; total_price: number; date: string; title: string; category: string },
    walletId: string,
    balanceBeforeInteraction?: number,
    subAccountId?: string,
  ): ExpenseEntity {
    return this.createExpense({
      amount: prediction.total_price,
      description: prediction.title,
      walletId,
      type: ExpenseType.expense,
      category: prediction.category,
      date: new Date(prediction.date),
      shop: prediction.merchant,
      spontaneousRate: 0.5,
      balanceBeforeInteraction,
      subAccountId,
    });
  }

  static createRefundedExpense(original: ExpenseEntity): ExpenseEntity {
    return Object.assign(new ExpenseEntity(), original, {
      type: ExpenseType.refunded,
      note: `Refunded at ${new Date().toISOString()} \n ${original.note ?? ''}`,
    });
  }

  static createBulkExpenses(expenses: ExpenseData[]): ExpenseEntity[] {
    return expenses.map((e) => this.createExpense(e));
  }

  static createExpenseWithSubExpenses(
    mainExpense: ExpenseData,
    subExpenses: Array<{ description: string; amount: number; category: string }>,
  ): { expense: ExpenseEntity; subExpenses: ExpenseSubExpense[] } {
    return {
      expense: this.createExpense(mainExpense),
      subExpenses: subExpenses.map((sub) => this.createSubExpense({ ...sub, expenseId: '' })),
    };
  }

  static createSubExpense(data: {
    description: string;
    amount: number;
    category: string;
    expenseId: string;
  }): ExpenseSubExpense {
    return Object.assign(new ExpenseSubExpense(), data);
  }

  static createLocation(data: {
    name: string;
    kind: string;
    longitude?: number;
    latitude?: number;
  }): ExpenseLocationEntity {
    return Object.assign(new ExpenseLocationEntity(), data);
  }

  static createExpenseFile(data: { url: string; expenseId: ExpenseEntity }): ExpenseFileEntity {
    return Object.assign(new ExpenseFileEntity(), data);
  }
}

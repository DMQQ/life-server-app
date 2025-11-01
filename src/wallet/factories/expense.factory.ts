import {
  ExpenseEntity,
  ExpenseType,
  ExpenseLocationEntity,
  ExpenseSubExpense,
  ExpenseFileEntity,
} from '../entities/wallet.entity';

export class ExpenseFactory {
  static createExpense(data: {
    amount: number;
    description: string;
    walletId: string;
    type?: ExpenseType;
    category?: string;
    date?: Date;
    schedule?: boolean;
    subscriptionId?: string;
    spontaneousRate?: number;
    balanceBeforeInteraction?: number;
    note?: string;
    shop?: string;
    tags?: string;
  }): ExpenseEntity {
    const expense = new ExpenseEntity();
    expense.amount = data.amount;
    expense.description = data.description;
    expense.walletId = data.walletId;
    expense.type = data.type || ExpenseType.expense;
    expense.category = data.category || 'none';
    expense.date = data.date || new Date();
    expense.schedule = data.schedule || false;
    expense.subscriptionId = data.subscriptionId;
    expense.spontaneousRate = data.spontaneousRate || 0;
    expense.balanceBeforeInteraction = data.balanceBeforeInteraction;
    expense.note = data.note;
    expense.shop = data.shop;
    expense.tags = data.tags;
    return expense;
  }

  static createIncomeExpense(data: {
    amount: number;
    description: string;
    walletId: string;
    category?: string;
    date?: Date;
    balanceBeforeInteraction?: number;
  }): ExpenseEntity {
    return this.createExpense({
      ...data,
      type: ExpenseType.income,
      category: data.category || 'income',
    });
  }

  static createScheduledExpense(data: {
    amount: number;
    description: string;
    walletId: string;
    date: Date;
    type?: ExpenseType;
    category?: string;
    subscriptionId?: string;
  }): ExpenseEntity {
    return this.createExpense({
      ...data,
      schedule: true,
    });
  }

  static createSubscriptionExpense(data: {
    amount: number;
    description: string;
    walletId: string;
    subscriptionId: string;
    category?: string;
    date?: Date;
    balanceBeforeInteraction?: number;
  }): ExpenseEntity {
    return this.createExpense({
      ...data,
      type: ExpenseType.expense,
      category: data.category || 'subscription',
    });
  }

  static createSubExpense(data: {
    description: string;
    amount: number;
    category: string;
    expenseId: string;
  }): ExpenseSubExpense {
    const subExpense = new ExpenseSubExpense();
    subExpense.description = data.description;
    subExpense.amount = data.amount;
    subExpense.category = data.category;
    subExpense.expenseId = data.expenseId;
    return subExpense;
  }

  static createLocation(data: {
    name: string;
    kind: string;
    longitude?: number;
    latitude?: number;
  }): ExpenseLocationEntity {
    const location = new ExpenseLocationEntity();
    location.name = data.name;
    location.kind = data.kind;
    location.longitude = data.longitude;
    location.latitude = data.latitude;
    return location;
  }

  static createExpenseFile(data: { url: string; expenseId: ExpenseEntity }): ExpenseFileEntity {
    const file = new ExpenseFileEntity();
    file.url = data.url;
    file.expenseId = data.expenseId;
    return file;
  }

  static createExpenseFromPrediction(
    prediction: {
      merchant: string;
      total_price: number;
      date: string;
      title: string;
      category: string;
    },
    walletId: string,
    balanceBeforeInteraction?: number,
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
    });
  }

  static createBulkExpenses(
    expenses: Array<{
      amount: number;
      description: string;
      walletId: string;
      type?: ExpenseType;
      category?: string;
      date?: Date;
    }>,
  ): ExpenseEntity[] {
    return expenses.map((expense) => this.createExpense(expense));
  }

  static createExpenseWithSubExpenses(
    mainExpense: {
      amount: number;
      description: string;
      walletId: string;
      type?: ExpenseType;
      category?: string;
      date?: Date;
    },
    subExpenses: Array<{
      description: string;
      amount: number;
      category: string;
    }>,
  ): {
    expense: ExpenseEntity;
    subExpenses: ExpenseSubExpense[];
  } {
    const expense = this.createExpense(mainExpense);

    return {
      expense,
      subExpenses: subExpenses.map((sub) => {
        const subExpense = new ExpenseSubExpense();
        subExpense.description = sub.description;
        subExpense.amount = sub.amount;
        subExpense.category = sub.category;
        subExpense.expenseId = ''; // Will be set after expense is saved
        return subExpense;
      }),
    };
  }

  static createRefundedExpense(originalExpense: ExpenseEntity): ExpenseEntity {
    const currentDate = new Date();
    const refundedExpense = new ExpenseEntity();
    Object.assign(refundedExpense, originalExpense);
    refundedExpense.type = ExpenseType.refunded;
    refundedExpense.note = `Refunded at ${currentDate.toISOString()} \n ${originalExpense.note ?? ''}`;
    return refundedExpense;
  }

  static createBalanceEditExpense(data: {
    newBalance: number;
    walletId: string;
    currentBalance: number;
  }): ExpenseEntity {
    return this.createExpense({
      amount: 0,
      description: `Balance edited to ${data.newBalance}`,
      walletId: data.walletId,
      type: ExpenseType.income,
      category: 'edit',
      balanceBeforeInteraction: data.currentBalance,
    });
  }
}

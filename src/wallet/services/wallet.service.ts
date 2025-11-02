import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import { ExpenseEntity, ExpenseType, WalletEntity } from 'src/wallet/entities/wallet.entity';
import { Brackets, Repository, Not, IsNull } from 'typeorm';
import { GetWalletFilters, WalletStatisticsRange } from '../types/wallet.schemas';
import { ExpenseFactory } from '../factories/expense.factory';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,

    @InjectRepository(ExpenseEntity)
    private readonly expenseRepository: Repository<ExpenseEntity>,
  ) {}

  async getWalletIdByUserId(userId: string) {
    return this.walletRepository.findOne({
      where: { userId },
      relations: ['expenses', 'expenses.subscription', 'expenses.files', 'expenses.location', 'expenses.subexpenses'],
    });
  }

  async editUserWalletBalance(
    userId: string,
    input: {
      amount: number;
      paycheck?: number;
      paycheckDate?: string;
    },
  ) {
    let wallet = await this.getWalletIdByUserId(userId);

    if (
      input.amount !== null &&
      input.amount !== undefined &&
      typeof input.amount === 'number' &&
      !isNaN(input.amount) &&
      input.amount >= 0
    ) {
      if (wallet) {
        await this.walletRepository.update(wallet.id, {
          balance: input.amount,
        });

        const balanceEditExpense = ExpenseFactory.createBalanceEditExpense({
          newBalance: input.amount,
          walletId: wallet.id,
          currentBalance: wallet.balance,
        });
        await this.expenseRepository.insert(balanceEditExpense);
      } else {
        await this.walletRepository.insert({
          balance: input.amount,
          userId,
          income: 0,
          monthlyPercentageTarget: 0,
        });
      }
    }

    if (input.paycheck && !isNaN(input.paycheck) && input.paycheck >= 0) {
      await this.walletRepository.update(
        { userId },
        {
          income: input.paycheck,
        },
      );
    }
    if (input.paycheckDate) {
      await this.walletRepository.update(
        { userId },
        {
          paycheckDate: input.paycheckDate,
        },
      );
    }

    return await this.getWalletByUserId(userId);
  }

  async getWalletByUserId(userId: string) {
    return this.walletRepository
      .createQueryBuilder('wallet')
      .leftJoinAndSelect('wallet.expenses', 'expenses')
      .leftJoinAndSelect('expenses.files', 'files')
      .leftJoinAndSelect('expenses.location', 'location')
      .leftJoinAndSelect('expenses.subexpenses', 'subexpenses')
      .where('wallet.userId = :userId', { userId })
      .andWhere('expenses.schedule = false OR expenses.id IS NULL')
      .getOne();
  }

  async findWalletId(userId: string) {
    return this.walletRepository.findOne({ where: { userId } });
  }

  async getExpensesByWalletId(
    walletId: string,
    settings?: {
      where: GetWalletFilters;
      pagination: { skip: number; take: number };
      isExactCategory?: boolean;
    },
  ) {
    const titleWords = (settings?.where?.title || '').trim().split(/\s+/).filter(Boolean);

    const expensesQuery = this.expenseRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.subscription', 'subscription')
      .leftJoinAndSelect('e.files', 'files')
      .leftJoinAndSelect('e.location', 'location')
      .leftJoinAndSelect('e.subexpenses', 'subexpenses')
      .where('e.walletId = :walletId', { walletId: walletId });

    if (titleWords.length > 0) {
      const titleConditions = titleWords.map((word, index) => `e.description LIKE :word${index}`).join(' OR ');

      expensesQuery.andWhere(
        `(${titleConditions})`,
        titleWords.reduce((acc, word, index) => {
          acc[`word${index}`] = `%${word}%`;
          return acc;
        }, {}),
      );
    }

    expensesQuery
      .andWhere('e.date >= :from AND e.date <= :to', {
        from: settings?.where?.date?.from || '1900-01-01',
        to: settings?.where?.date?.to || '2100-01-01',
      })
      .andWhere('e.amount >= :min AND e.amount <= :max', {
        min: settings?.where?.amount?.from || 0,
        max: settings?.where?.amount?.to || 1000000000,
      })
      .andWhere('e.type IN(:...type)', {
        type: settings?.where?.type
          ? [settings.where.type]
          : [ExpenseType.expense, ExpenseType.income, ExpenseType.refunded],
      })
      .andWhere('e.schedule = :schedule', { schedule: false });

    if (settings?.where?.category.length > 0 && !settings?.isExactCategory) {
      const categories = settings?.where?.category?.map((m) => m.split(':').shift());

      expensesQuery.andWhere(
        new Brackets((qb) => {
          categories.forEach((category, index) => {
            qb.orWhere(`e.category LIKE :category${index}`, {
              ['category' + index]: `%${category}%`,
            });
          });
        }),
      );
      // expensesQuery.andWhere('e.category IN (:...category)', { category: settings.where.category });
    } else if (settings?.isExactCategory && settings?.where?.category?.length === 1) {
      expensesQuery.andWhere('e.category = :category', { category: settings?.where?.category?.shift() });
    }

    const expenses = await expensesQuery
      .orderBy('e.date', 'DESC')
      .skip(settings?.pagination.skip || 0)
      .take(settings?.pagination.take || 10)
      .cache(true)
      .getMany();

    return expenses;
  }

  async createExpense(
    userId: string,
    amount: number,
    description: string,
    type: ExpenseType,
    category: string,
    date: Date,
    schedule: boolean = false,
    subscription: string | null,
    spontaneousRate: number,
  ) {
    const wallet = await this.getWalletIdByUserId(userId);

    let walletId = wallet?.id as string;

    const newExpense = ExpenseFactory.createExpense({
      amount,
      description,
      walletId: walletId,
      type,
      balanceBeforeInteraction: wallet?.balance as number,
      category,
      date,
      schedule,
      spontaneousRate: spontaneousRate ?? 0,
      subscriptionId: subscription,
    });
    const insert = await this.expenseRepository.insert(newExpense);

    if (schedule && date > new Date())
      return this.expenseRepository.findOne({
        where: { id: insert.identifiers[0].id },
      });

    await this._updateWalletBalance(
      userId,
      amount,
      type === ExpenseType.expense ? ExpenseType.expense : ExpenseType.income,
    );

    const expense = await this.expenseRepository.findOne({
      where: { id: insert.identifiers[0].id },
      relations: ['subexpenses', 'subscription'],
    });

    return { ...expense, walletId };
  }

  async getSubscriptionLastExpense(subscriptionId: string) {
    return await this.expenseRepository.findOne({
      where: {
        subscriptionId: subscriptionId,
      },
      order: { date: 'DESC' },
    });
  }

  // Update the createSubscriptionExpense method to use subscriptionId
  async createSubscriptionExpense(walletId: string, expense: Partial<ExpenseEntity>) {
    const wallet = await this.walletRepository.findOne({
      where: { id: walletId },
    });

    const subscriptionExpense = ExpenseFactory.createSubscriptionExpense({
      amount: expense.amount,
      description: expense.description,
      walletId: walletId,
      subscriptionId: expense.subscriptionId,
      category: expense.category,
      date: expense.date,
      balanceBeforeInteraction: wallet?.balance as number,
    });
    const insert = await this.expenseRepository.insert(subscriptionExpense);

    await this._updateWalletBalance(wallet.userId, expense.amount, ExpenseType.expense);

    return this.expenseRepository.findOne({
      where: { id: insert.identifiers[0].id },
    });
  }

  async getExpenses(userId: string) {
    return await this.expenseRepository.find({
      where: {
        walletId: (await this.getWalletIdByUserId(userId)).id,
        schedule: false,
      },
    });
  }

  async deleteExpense(id: string, userId: string) {
    const expense = await this.expenseRepository.findOne({ where: { id } });

    if (expense && expense !== null && typeof expense !== 'undefined') {
      const { amount, type } = expense as ExpenseEntity;

      await this.expenseRepository.delete({ id });

      if (type !== ExpenseType.refunded) {
        const updateResult = await this._updateWalletBalance(
          userId,
          amount,
          type === ExpenseType.expense ? ExpenseType.income : ExpenseType.expense,
        );

        return updateResult.affected > 0;
      }
    }
  }

  private async _updateWalletBalance(userId: string, amount: number, type: ExpenseType) {
    return this.walletRepository.update(
      { userId },
      {
        balance: () => (type === ExpenseType.expense ? `balance - ${amount}` : `balance + ${amount}`),
      },
    );
  }

  async addScheduledTransaction(transaction: {
    walletId: string;
    type: ExpenseType;
    amount: number;
    id: string;
    date: string;
  }) {
    await this.walletRepository.update(
      { id: transaction.walletId },
      {
        balance: () =>
          transaction.type === ExpenseType.expense
            ? `balance - ${transaction.amount}`
            : `balance + ${transaction.amount}`,
      },
    );

    return this.expenseRepository.update(transaction.id, { schedule: false });
  }

  async getScheduledTransactions(_date: Date) {
    const date = dayjs(_date || new Date()).format('YYYY-MM-DD');

    const startOfDay = `${date} 00:00:00`;
    const endOfDay = `${date} 23:59:59`;

    return this.expenseRepository.query(
      'SELECT id, walletId, type, amount, date FROM expense WHERE schedule = 1 AND date >= ? AND date <= ?',
      [startOfDay, endOfDay],
    );
  }

  async editExpense(
    expenseId: string,
    userId: string,
    incoming: Partial<ExpenseEntity> & { amount: number; type: string },
  ) {
    const wallet = await this.walletRepository.findOne({ where: { userId } });
    const exisitng = await this.expenseRepository.findOne({
      where: { id: expenseId },
    });

    if (typeof wallet === 'undefined' || wallet == null) throw new Error('Expense doesnt exist');

    let balance = wallet.balance;
    let originalBalance = wallet.balance;

    if (incoming.type === ExpenseType.refunded) {
      balance = exisitng.type === 'income' ? wallet.balance - exisitng.amount : wallet.balance + exisitng.amount;
    } else {
      originalBalance =
        exisitng.type === 'income' ? wallet.balance - exisitng.amount : wallet.balance + exisitng.amount; // restoring balance to state without this expense

      balance = incoming.type === 'income' ? originalBalance + incoming.amount : originalBalance - incoming.amount; // operating on old balance to create new with new expense
    }

    await this.walletRepository.update(
      { userId },
      {
        balance,
      },
    );

    await this.expenseRepository.update(
      {
        id: expenseId,
      },
      {
        ...incoming,
        balanceBeforeInteraction: originalBalance,
      },
    );

    return await this.expenseRepository.findOne({ where: { id: expenseId } });
  }

  async getMonthTotalByType(type: 'income' | 'expense', userId: string, month: number, year: number) {
    const date = new Date(year, month, 1);

    const expenses = await this.expenseRepository.query(
      `
      SELECT SUM(amount) as total FROM expense WHERE walletId = (
        SELECT id FROM wallet WHERE userId = ?
      ) AND type = ? AND date >= ? AND date < DATE_ADD(?, INTERVAL 1 MONTH) AND schedule = 0
    `,
      [userId, type, date, date],
    );

    return expenses[0].total;
  }

  async getStatistics(userId: string, dateRange: [string, string]): Promise<[WalletStatisticsRange]> {
    const [startDate, endDate] = dateRange;

    if (!startDate || !endDate) return Promise.reject(`startDate '${startDate}' or endDate '${endDate}' is empty`);

    return this.expenseRepository.query(
      `
      WITH walletId AS (
        SELECT id FROM wallet WHERE userId = ?
      )
      SELECT 
        COALESCE(SUM(e.amount), 0) AS total,
        COALESCE(AVG(e.amount), 0) AS average,
        COALESCE(MAX(e.amount), 0) AS max,
        COALESCE(MIN(e.amount), 0) AS min,
        COALESCE(COUNT(*), 0) AS count,
        (SELECT SUBSTRING_INDEX(category, ':', 1) as category FROM expense WHERE walletId = (SELECT id FROM walletId) AND date >= ? AND date <= ? AND schedule = 0 GROUP BY SUBSTRING_INDEX(category, ':', 1) ORDER BY COUNT(*) DESC LIMIT 1) AS theMostCommonCategory,
        (SELECT SUBSTRING_INDEX(category, ':', 1) as category FROM expense WHERE walletId = (SELECT id FROM walletId) AND date >= ? AND date <= ? AND schedule = 0 GROUP BY SUBSTRING_INDEX(category, ':', 1) ORDER BY COUNT(*) ASC LIMIT 1) AS theLeastCommonCategory,
        COALESCE((SELECT SUM(amount) FROM expense WHERE walletId = (SELECT id FROM walletId) AND type = 'income' AND date >= ? AND date <= ? AND schedule = 0), 0) AS income,
        COALESCE((SELECT SUM(amount) FROM expense WHERE walletId = (SELECT id FROM walletId) AND type = 'expense' AND date >= ? AND date <= ? AND schedule = 0), 0) AS expense,
        (SELECT balance FROM wallet WHERE userId = ?) AS lastBalance
      FROM expense e
      JOIN walletId w ON e.walletId = w.id
      WHERE e.date >= ? 
        AND e.date <= ? AND e.schedule = 0
        AND type = 'expense'
  `,
      [
        userId, // for walletId subquery
        startDate, // for mostCommonCategory date range
        endDate, // for mostCommonCategory date range
        startDate, // for leastCommonCategory date range
        endDate, // for leastCommonCategory date range
        startDate, // for income date range
        endDate, // for income date range
        startDate, // for expense date range
        endDate, // for expense date range
        userId, // for lastBalance subquery
        startDate, // for main query date range
        endDate, // for main query date range
      ],
    );
  }

  async createWallet(userId: string, initialBalance: number) {
    const wallet = await this.walletRepository.findOne({ where: { userId } });

    if (wallet) throw new Error('Wallet already exists, unable to create new');

    const walletInsert = await this.walletRepository.insert({
      userId,
      balance: initialBalance,
    });

    const walletId = walletInsert.identifiers[0].id;

    const initExpense = ExpenseFactory.createExpense({
      walletId: walletId,
      amount: initialBalance,
      type: initialBalance > 0 ? ExpenseType.income : ExpenseType.expense,
      category: 'edit',
      date: new Date(),
      note: '',
      description: 'Initialized wallet with ' + initialBalance,
    });
    return this.expenseRepository.insert(initExpense);
  }

  async refundExpense(userId: string, expenseId: string) {
    if (userId === '' || expenseId === '') throw new Error('Invalid args provided to refundExpense');

    try {
      await this.expenseRepository.manager.transaction(async (entityManager) => {
        const expense = await entityManager.findOneOrFail(ExpenseEntity, {
          where: { id: expenseId },
        });

        const wallet = await entityManager.findOne(WalletEntity, {
          where: { userId },
        });

        if (!wallet) throw new Error('Wallet not found');

        const originalAmount = expense.amount;
        const balanceAdjustment = expense.type === ExpenseType.income ? -originalAmount : originalAmount;

        wallet.balance += balanceAdjustment;
        await entityManager.save(WalletEntity, wallet);

        expense.type = ExpenseType.refunded;
        expense.note = `Refunded at ${dayjs().format('YYYY-MM-DD HH:mm')} \n ${expense.note ?? ''}`;
        await entityManager.save(ExpenseEntity, expense);
      });

      return this.expenseRepository.findOne({ where: { id: expenseId } });
    } catch (error) {
      console.error('Refund error:', error);
      throw new Error('Refund failed');
    }
  }

  async getExpense(id: string) {
    return this.expenseRepository.findOneOrFail({
      where: { id },
      relations: ['subscription', 'files', 'location', 'subexpenses'],
    });
  }

  async getWallet(id: string) {
    return this.walletRepository.findOne({
      where: { id },
    });
  }

  async getWalletId(userId: string) {
    return (await this.walletRepository.findOne({ where: { userId } }))?.id;
  }

  async createExpenseFromAIPrediction(
    prediction: {
      merchant: string;
      total_price: number;
      date: string;
      subexpenses: { name: string; quantity: number; amount: number }[];
      title: string;
      category: string;
    },
    userId: string,
  ) {
    const wallet = await this.getWalletIdByUserId(userId);
    const predictionExpense = ExpenseFactory.createExpenseFromPrediction(
      {
        merchant: prediction.merchant,
        total_price: prediction.total_price,
        date: prediction.date,
        title: prediction.title + ' ',
        category: prediction.category,
      },
      wallet.id,
      wallet.balance,
    );

    const insert = await this.expenseRepository.insert(predictionExpense);

    await this._updateWalletBalance(userId, prediction.total_price, ExpenseType.expense);

    return this.expenseRepository.findOne({
      where: { id: insert.identifiers[0].id },
      relations: ['subexpenses', 'subscription'],
    });
  }

  async getWalletsWithPaycheckDate() {
    return this.walletRepository.find({
      where: [{ paycheckDate: Not(IsNull()) }],
      select: ['id', 'userId', 'income', 'paycheckDate'],
    });
  }
}

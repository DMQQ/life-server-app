import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import {
  CreateSubAccountInput,
  ExpenseEntity,
  ExpenseType,
  UpdateSubAccountInput,
  WalletEntity,
  WalletSubAccount,
} from 'src/wallet/entities/wallet.entity';
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

    @InjectRepository(WalletSubAccount)
    private readonly subAccountRepository: Repository<WalletSubAccount>,
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
        const general = await this._getOrCreateGeneralAccount(wallet.id, wallet.balance);
        await this.subAccountRepository.update({ id: general.id }, { balance: input.amount });
        await this._syncWalletBalance(wallet.id);

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

  async getExpensesGroupedByMonth(
    walletId: string,
    settings?: {
      where: GetWalletFilters;
      monthPagination: { skip: number; take: number };
      isExactCategory?: boolean;
    },
  ): Promise<{ month: string; expenses: ExpenseEntity[] }[]> {
    const skip = settings?.monthPagination?.skip ?? 0;
    const take = settings?.monthPagination?.take ?? 6;
    const titleWords = (settings?.where?.title || '').trim().split(/\s+/).filter(Boolean);

    const buildBase = () => {
      const q = this.expenseRepository
        .createQueryBuilder('e')
        .where('e.walletId = :walletId', { walletId })
        .andWhere('e.schedule = :schedule', { schedule: false })
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
        });

      if (titleWords.length > 0) {
        const titleConditions = titleWords.map((_, i) => `e.description LIKE :word${i}`).join(' OR ');
        q.andWhere(
          `(${titleConditions})`,
          titleWords.reduce((acc, w, i) => ({ ...acc, [`word${i}`]: `%${w}%` }), {}),
        );
      }

      if (settings?.where?.category?.length > 0 && !settings?.isExactCategory) {
        const categories = settings.where.category.map((c) => c.split(':').shift());
        q.andWhere(
          new Brackets((qb) => {
            categories.forEach((cat, i) => qb.orWhere(`e.category LIKE :cat${i}`, { [`cat${i}`]: `%${cat}%` }));
          }),
        );
      } else if (settings?.isExactCategory && settings?.where?.category?.length === 1) {
        q.andWhere('e.category = :category', { category: settings.where.category[0] });
      }
      if (settings?.where?.accountId) {
        q.andWhere('e.subAccountId = :accountId', { accountId: settings.where.accountId });
      }

      return q;
    };

    const monthRows = await buildBase()
      .select("DATE_FORMAT(e.date, '%Y-%m')", 'month')
      .groupBy('month')
      .orderBy('month', 'DESC')
      .offset(skip)
      .limit(take)
      .getRawMany<{ month: string }>();

    if (monthRows.length === 0) return [];

    const months = monthRows.map((r) => r.month);

    const expenses = await buildBase()
      .leftJoinAndSelect('e.subscription', 'subscription')
      .leftJoinAndSelect('e.files', 'files')
      .leftJoinAndSelect('e.location', 'location')
      .leftJoinAndSelect('e.subexpenses', 'subexpenses')
      .andWhere("DATE_FORMAT(e.date, '%Y-%m') IN (:...months)", { months })
      .orderBy('e.date', 'DESC')
      .getMany();

    const monthMap = new Map<string, ExpenseEntity[]>(months.map((m) => [m, []]));
    for (const expense of expenses) {
      const month = new Date(expense.date).toISOString().slice(0, 7);
      monthMap.get(month)?.push(expense);
    }

    return months.map((month) => ({ month, expenses: monthMap.get(month) ?? [] }));
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
    shop?: string,
    subAccountId?: string,
  ) {
    const wallet = await this.getWalletIdByUserId(userId);

    let walletId = wallet?.id as string;

    const resolvedSubAccountId = subAccountId ?? (await this._getOrCreateGeneralAccount(walletId)).id;

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
      shop,
      subAccountId: resolvedSubAccountId,
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
      resolvedSubAccountId,
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

    const general = await this._getOrCreateGeneralAccount(walletId);

    const subscriptionExpense = ExpenseFactory.createSubscriptionExpense({
      amount: expense.amount,
      description: expense.description,
      walletId: walletId,
      subscriptionId: expense.subscriptionId,
      category: expense.category,
      date: expense.date,
      balanceBeforeInteraction: wallet?.balance as number,
      subAccountId: expense.subAccountId ?? general.id,
    });
    const insert = await this.expenseRepository.insert(subscriptionExpense);

    await this._updateWalletBalance(wallet.userId, expense.amount, ExpenseType.expense, expense.subAccountId ?? general.id);

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
      const { amount, type, subAccountId } = expense as ExpenseEntity;

      await this.expenseRepository.delete({ id });

      if (type !== ExpenseType.refunded) {
        await this._updateWalletBalance(
          userId,
          amount,
          type === ExpenseType.expense ? ExpenseType.income : ExpenseType.expense,
          subAccountId,
        );

        return true;
      }
    }
  }

  async _getOrCreateGeneralAccount(walletId: string, initialBalance = 0): Promise<WalletSubAccount> {
    let general = await this.subAccountRepository.findOne({ where: { walletId, isDefault: true } });
    if (!general) {
      const result = await this.subAccountRepository.insert({
        walletId,
        name: 'General',
        isDefault: true,
        balance: initialBalance,
        icon: 'bank',
        color: '7B84FF',
      });
      general = await this.subAccountRepository.findOne({ where: { id: result.identifiers[0].id } });
    }
    return general;
  }

  private async _syncWalletBalance(walletId: string) {
    await this.walletRepository.query(
      `UPDATE wallet SET balance = (SELECT COALESCE(SUM(balance), 0) FROM wallet_sub_account WHERE walletId = ?) WHERE id = ?`,
      [walletId, walletId],
    );
  }

  private async _updateWalletBalance(userId: string, amount: number, type: ExpenseType, subAccountId?: string) {
    const op = type === ExpenseType.expense ? `balance - ${amount}` : `balance + ${amount}`;

    const wallet = await this.walletRepository.findOne({ where: { userId } });

    // Resolve target sub-account: explicit one or the default General account
    let targetId = subAccountId;
    if (!targetId) {
      const general = await this._getOrCreateGeneralAccount(wallet.id);
      targetId = general.id;
    }

    await this.subAccountRepository.update({ id: targetId }, { balance: () => op });
    await this._syncWalletBalance(wallet.id);
  }

  async addScheduledTransaction(transaction: {
    walletId: string;
    type: ExpenseType;
    amount: number;
    id: string;
    date: string;
  }) {
    const op =
      transaction.type === ExpenseType.expense ? `balance - ${transaction.amount}` : `balance + ${transaction.amount}`;

    const general = await this._getOrCreateGeneralAccount(transaction.walletId);
    await this.subAccountRepository.update({ id: general.id }, { balance: () => op });
    await this._syncWalletBalance(transaction.walletId);

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

    // Determine which sub-account holds this expense (fall back to General)
    const subAccountId = incoming.subAccountId ?? exisitng.subAccountId;
    let targetAccount = subAccountId
      ? await this.subAccountRepository.findOne({ where: { id: subAccountId } })
      : await this._getOrCreateGeneralAccount(wallet.id, wallet.balance);

    const accountBalance = targetAccount.balance;
    let newAccountBalance = accountBalance;
    let originalBalance = wallet.balance;

    if (incoming.type === ExpenseType.refunded) {
      newAccountBalance =
        exisitng.type === 'income' ? accountBalance - exisitng.amount : accountBalance + exisitng.amount;
    } else {
      const restoredBalance =
        exisitng.type === 'income' ? accountBalance - exisitng.amount : accountBalance + exisitng.amount;
      newAccountBalance =
        incoming.type === 'income' ? restoredBalance + incoming.amount : restoredBalance - incoming.amount;
      originalBalance =
        exisitng.type === 'income' ? wallet.balance - exisitng.amount : wallet.balance + exisitng.amount;
    }

    await this.subAccountRepository.update({ id: targetAccount.id }, { balance: newAccountBalance });
    await this._syncWalletBalance(wallet.id);

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

    // Always create a General account so all expenses have a home
    await this._getOrCreateGeneralAccount(walletId, initialBalance);

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

  async createSubAccount(userId: string, input: CreateSubAccountInput) {
    const wallet = await this.walletRepository.findOne({ where: { userId } });

    // Ensure the General account exists so the existing wallet.balance lives somewhere
    await this._getOrCreateGeneralAccount(wallet.id, wallet.balance);

    const result = await this.subAccountRepository.insert({
      ...input,
      walletId: wallet.id,
      isDefault: false,
      balance: input.balance ?? 0,
    });

    // wallet.balance = sum of all sub-accounts (General + new ones)
    await this._syncWalletBalance(wallet.id);

    return this.subAccountRepository.findOne({ where: { id: result.identifiers[0].id } });
  }

  async getSubAccounts(userId: string) {
    const wallet = await this.walletRepository.findOne({ where: { userId } });
    return this.subAccountRepository.find({ where: { walletId: wallet.id } });
  }

  async updateSubAccount(id: string, input: UpdateSubAccountInput) {
    await this.subAccountRepository.update({ id }, input);
    if (input.balance !== undefined) {
      const account = await this.subAccountRepository.findOne({ where: { id } });
      await this._syncWalletBalance(account.walletId);
    }
    return this.subAccountRepository.findOne({ where: { id } });
  }

  async deleteSubAccount(id: string) {
    const account = await this.subAccountRepository.findOne({ where: { id } });
    if (account?.isDefault) throw new Error('Cannot delete the General account');

    const general = await this.subAccountRepository.findOne({ where: { walletId: account.walletId, isDefault: true } });
    if (general) {
      await this.expenseRepository.update({ subAccountId: id }, { subAccountId: general.id });
      // Move the deleted account's balance into General
      await this.subAccountRepository.update({ id: general.id }, { balance: () => `balance + ${account.balance}` });
    } else {
      await this.expenseRepository.update({ subAccountId: id }, { subAccountId: null });
    }

    const result = await this.subAccountRepository.delete({ id });
    if (general) await this._syncWalletBalance(account.walletId);
    return result.affected > 0;
  }

  async getWalletsWithPaycheckDate() {
    return this.walletRepository.find({
      where: [{ paycheckDate: Not(IsNull()) }],
      select: ['id', 'userId', 'income', 'paycheckDate'],
    });
  }
}

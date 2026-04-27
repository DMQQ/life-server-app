import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import { ExpenseEntity, ExpenseType, WalletEntity, WalletSubAccount } from 'src/wallet/entities/wallet.entity';
import { Brackets, Repository, Not, IsNull } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GetWalletFilters, MonthlyExpenses, WalletStatisticsRange } from '../types/wallet.schemas';
import { ExpenseFactory } from '../factories/expense.factory';
import { ObservableRepository } from 'src/utils/emitter/observable-repository';
import { CreateExpenseInput, EditExpenseInput, EditWalletBalanceInput } from '../dto/wallet.dto';
import SubscriptionFactory from '../factories/subscription.factory';
import { SubAccountService } from './sub-account.service';

@Injectable()
export class WalletService {
  private readonly expenseRepository: ObservableRepository<ExpenseEntity>;

  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,

    @InjectRepository(ExpenseEntity)
    _expenseRepo: Repository<ExpenseEntity>,

    private readonly subAccountService: SubAccountService,

    private readonly eventEmitter: EventEmitter2,
  ) {
    this.expenseRepository = new ObservableRepository(_expenseRepo, eventEmitter, 'expense');
  }

  async getWalletIdByUserId(userId: string) {
    return this.walletRepository.findOne({
      where: { userId },
      relations: ['expenses', 'expenses.subscription', 'expenses.files', 'expenses.location', 'expenses.subexpenses'],
    });
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

  async getWallet(id: string) {
    return this.walletRepository.findOne({ where: { id } });
  }

  async getWalletId(userId: string) {
    return (await this.walletRepository.findOne({ where: { userId } }))?.id;
  }

  async getWalletsWithPaycheckDate() {
    return this.walletRepository.find({
      where: [{ paycheckDate: Not(IsNull()) }],
      select: ['id', 'userId', 'income', 'paycheckDate'],
    });
  }

  async createWallet(userId: string, initialBalance: number) {
    const wallet = await this.walletRepository.findOne({ where: { userId } });
    if (wallet) throw new Error('Wallet already exists, unable to create new');

    const walletInsert = await this.walletRepository.insert({ userId, balance: initialBalance });
    const walletId = walletInsert.identifiers[0].id;

    await this.subAccountService.getOrCreateDefaultAccount(walletId, initialBalance);

    const initExpense = ExpenseFactory.createExpense({
      walletId,
      amount: initialBalance,
      type: initialBalance > 0 ? ExpenseType.income : ExpenseType.expense,
      category: 'edit',
      date: new Date(),
      note: '',
      description: 'Initialized wallet with ' + initialBalance,
    });
    return this.expenseRepository.insert(initExpense);
  }

  async editUserWalletBalance(userId: string, input: EditWalletBalanceInput) {
    const wallet = await this.getWalletIdByUserId(userId);

    if (
      input.amount !== null &&
      input.amount !== undefined &&
      typeof input.amount === 'number' &&
      !isNaN(input.amount) &&
      input.amount >= 0
    ) {
      if (wallet) {
        const general = await this.subAccountService.getOrCreateDefaultAccount(wallet.id, wallet.balance);
        await this.subAccountService.update(general.id, { balance: input.amount });

        const balanceEditExpense = ExpenseFactory.createBalanceEditExpense({
          newBalance: input.amount,
          walletId: wallet.id,
          currentBalance: wallet.balance,
          subAccountId: general.id,
        });
        await this.expenseRepository.insert(balanceEditExpense);
      } else {
        await this.walletRepository.insert({ balance: input.amount, userId, income: 0, monthlyPercentageTarget: 0 });
      }
    }

    if (input.paycheck && !isNaN(input.paycheck) && input.paycheck >= 0) {
      await this.walletRepository.update({ userId }, { income: input.paycheck });
    }

    if (input.paycheckDate) {
      await this.walletRepository.update({ userId }, { paycheckDate: input.paycheckDate });
    }

    return this.getWalletByUserId(userId);
  }

  async getExpense(id: string) {
    return this.expenseRepository.findOneOrFail({
      where: { id },
      relations: ['subscription', 'files', 'location', 'subexpenses'],
    });
  }

  async getExpenses(userId: string) {
    return this.expenseRepository.find({
      where: { walletId: (await this.getWalletIdByUserId(userId)).id, schedule: false },
    });
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

    const q = this.expenseRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.subscription', 'subscription')
      .leftJoinAndSelect('e.files', 'files')
      .leftJoinAndSelect('e.location', 'location')
      .leftJoinAndSelect('e.subexpenses', 'subexpenses')
      .where('e.walletId = :walletId', { walletId });

    if (titleWords.length > 0) {
      const titleConditions = titleWords.map((_, i) => `e.description LIKE :word${i}`).join(' OR ');
      q.andWhere(`(${titleConditions})`, titleWords.reduce((acc, w, i) => ({ ...acc, [`word${i}`]: `%${w}%` }), {}));
    }

    q.andWhere('e.date >= :from AND e.date <= :to', {
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
      q.andWhere(
        new Brackets((qb) => {
          categories.forEach((category, index) => {
            qb.orWhere(`e.category LIKE :category${index}`, { [`category${index}`]: `%${category}%` });
          });
        }),
      );
    } else if (settings?.isExactCategory && settings?.where?.category?.length === 1) {
      q.andWhere('e.category = :category', { category: settings.where.category[0] });
    }

    return q
      .orderBy('e.date', 'DESC')
      .skip(settings?.pagination.skip || 0)
      .take(settings?.pagination.take || 10)
      .cache(true)
      .getMany();
  }

  async getExpensesGroupedByMonth(
    walletId: string,
    settings?: {
      where: GetWalletFilters;
      monthPagination: { skip: number; take: number };
      isExactCategory?: boolean;
    },
  ): Promise<MonthlyExpenses[]> {
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

    return months.map((month) => ({ month, expenses: monthMap.get(month) ?? [] })).map(({ month, expenses }) => {
      const flow = expenses.reduce(
        (acc, e) => {
          if (e.type === 'income') acc.income += e.amount;
          else if (e.type === 'expense') acc.expense += e.amount;
          return acc;
        },
        { income: 0, expense: 0 },
      );
      return { month, flow, expenses };
    });
  }

  async createExpenseFromInput(userId: string, input: CreateExpenseInput | ExpenseEntity) {
    const wallet = await this.getWalletIdByUserId(userId);
    const subAccountId = input.subAccountId ?? (await this.subAccountService.getOrCreateDefaultAccount(wallet.id)).id;

    let entity = ExpenseFactory.createExpense({ ...input, walletId: wallet.id, subAccountId });

    if (input.category.startsWith('subscription')) {
      entity.subscription = SubscriptionFactory.create(input);
    }

    entity = await this.expenseRepository.save(entity);
    return this.getExpense(entity.id);
  }

  async createSubscriptionExpense(walletId: string, expense: Partial<ExpenseEntity>) {
    const wallet = await this.walletRepository.findOne({ where: { id: walletId } });
    const general = await this.subAccountService.getOrCreateDefaultAccount(walletId);

    const subscriptionExpense = ExpenseFactory.createSubscriptionExpense({
      amount: expense.amount,
      description: expense.description,
      walletId,
      subscriptionId: expense.subscriptionId,
      category: expense.category,
      date: expense.date,
      balanceBeforeInteraction: wallet?.balance as number,
      subAccountId: expense.subAccountId ?? general.id,
    });
    const insert = await this.expenseRepository.insert(subscriptionExpense);
    return this.expenseRepository.findOne({ where: { id: insert.identifiers[0].id } });
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
    const general = await this.subAccountService.getOrCreateDefaultAccount(wallet.id);

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
      general.id,
    );

    const insert = await this.expenseRepository.insert(predictionExpense);
    return this.expenseRepository.findOne({
      where: { id: insert.identifiers[0].id },
      relations: ['subexpenses', 'subscription'],
    });
  }

  async editExpenseNote(id: string, note: string) {
    return this.expenseRepository.update({ id }, { note });
  }

  async editExpense(expenseId: string, userId: string, incoming: EditExpenseInput) {
    const wallet = await this.walletRepository.findOneOrFail({ where: { userId } });
    const existing = await this.expenseRepository.findOneOrFail({ where: { id: expenseId } });

    const originalBalance =
      existing.type === ExpenseType.income ? wallet.balance - existing.amount : wallet.balance + existing.amount;

    const { expenseId: _, ...fields } = incoming;
    await this.expenseRepository.update({ id: expenseId }, { ...fields, balanceBeforeInteraction: originalBalance });
    return this.expenseRepository.findOne({ where: { id: expenseId } });
  }

  async deleteExpense(id: string, userId: string) {
    return this.expenseRepository.delete({ id });
  }

  async refundExpense(userId: string, expenseId: string) {
    if (!userId || !expenseId) throw new Error('Invalid args provided to refundExpense');

    try {
      await this.expenseRepository.manager.transaction(async (entityManager) => {
        const expense = await entityManager.findOneOrFail(ExpenseEntity, { where: { id: expenseId } });
        const hasSubaccount = expense.subAccountId != null;

        if (!hasSubaccount) {
          const wallet = await entityManager.findOne(WalletEntity, { where: { userId } });
          if (!wallet) throw new Error('Wallet not found');

          const adjustment = expense.type === ExpenseType.income ? -expense.amount : expense.amount;
          wallet.balance += adjustment;
          await entityManager.save(WalletEntity, wallet);
        } else {
          const subAccount = await entityManager.findOne(WalletSubAccount, { where: { id: expense.subAccountId } });
          if (!subAccount) throw new Error('Sub-account not found');

          const adjustment = expense.type === ExpenseType.income ? -expense.amount : expense.amount;
          subAccount.balance += adjustment;
          await entityManager.save(WalletSubAccount, subAccount);

          await entityManager.query(
            `UPDATE wallet SET balance = (SELECT COALESCE(SUM(balance), 0) FROM wallet_sub_account WHERE walletId = ?) WHERE id = ?`,
            [subAccount.walletId, subAccount.walletId],
          );
        }

        expense.type = ExpenseType.refunded;
        expense.note = `Refunded at ${dayjs().format('YYYY-MM-DD HH:mm')} \n ${expense.note ?? ''}`;
        await entityManager.save(ExpenseEntity, expense);
      });

      return this.expenseRepository.findOne({ where: { id: expenseId } });
    } catch (error) {
      console.error('Error during refundExpense transaction:', error);
      throw new Error('Refund failed');
    }
  }

  async getSubscriptionLastExpense(subscriptionId: string) {
    return this.expenseRepository.findOne({
      where: { subscriptionId },
      order: { date: 'DESC' },
    });
  }

  async getScheduledTransactions(_date: Date) {
    const date = dayjs(_date || new Date()).format('YYYY-MM-DD');
    return this.expenseRepository.query(
      'SELECT id, walletId, type, amount, date FROM expense WHERE schedule = 1 AND date >= ? AND date <= ?',
      [`${date} 00:00:00`, `${date} 23:59:59`],
    );
  }

  async addScheduledTransaction(transaction: {
    walletId: string;
    type: ExpenseType;
    amount: number;
    id: string;
    date: string;
  }) {
    return this.expenseRepository.update({ id: transaction.id }, { schedule: false });
  }

  async getMonthTotalByType(type: 'income' | 'expense', userId: string, month: number, year: number) {
    const date = new Date(year, month, 1);
    const expenses = await this.expenseRepository.query(
      `SELECT SUM(amount) as total FROM expense
       WHERE walletId = (SELECT id FROM wallet WHERE userId = ?)
         AND type = ? AND date >= ? AND date < DATE_ADD(?, INTERVAL 1 MONTH) AND schedule = 0`,
      [userId, type, date, date],
    );
    return expenses[0].total;
  }

  async getStatistics(userId: string, dateRange: [string, string]): Promise<WalletStatisticsRange> {
    const [startDate, endDate] = dateRange;

    if (!startDate || !endDate) return Promise.reject(`startDate '${startDate}' or endDate '${endDate}' is empty`);

    const result = await this.expenseRepository.query(
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
      WHERE e.date >= ? AND e.date <= ? AND e.schedule = 0 AND type = 'expense'
      `,
      [
        userId,
        startDate, endDate,
        startDate, endDate,
        startDate, endDate,
        startDate, endDate,
        userId,
        startDate, endDate,
      ],
    );

    if (!result || result.length === 0) return Promise.reject('Failed to calculate statistics');
    return result[0];
  }
}

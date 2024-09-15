import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ExpenseEntity,
  ExpenseType,
  WalletEntity,
} from 'src/wallet/wallet.entity';
import { Between, Repository } from 'typeorm';
import { GetWalletFilters, WalletStatisticsRange } from './wallet.schemas';
import * as moment from 'moment';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,

    @InjectRepository(ExpenseEntity)
    private readonly expenseRepository: Repository<ExpenseEntity>,
  ) {}

  async getWalletIdByUserId(userId: string) {
    const wallet = await this.walletRepository.findOne({
      where: { userId, expenses: { schedule: false } },
      relations: ['expenses'],
    });

    return wallet;
  }

  async editUserWalletBalance(userId: string, amount: number) {
    let wallet = await this.getWalletIdByUserId(userId);

    if (wallet) {
      await this.walletRepository.update(wallet.id, {
        balance: amount,
      });

      await this.expenseRepository.insert({
        amount: 0,
        description: `Balance edited to ${amount}`,
        date: new Date(),
        walletId: wallet.id,
        type: ExpenseType.income,
        category: 'edit',
        balanceBeforeInteraction: wallet.balance,
      });

      return await this.getWalletIdByUserId(userId);
    } else {
      await this.walletRepository.insert({
        balance: amount,
        userId,
      });
    }
  }

  async getWalletByUserId(userId: string) {
    const wallet = await this.walletRepository.findOne({
      relations: ['expenses'],
      where: {
        userId,
        expenses: { schedule: false },
      },
    });

    if (!wallet) {
      const walletInsert = this.walletRepository.save({
        balance: 0,
        userId,
      });

      return walletInsert;
    }

    return wallet;
  }

  async getExpensesByWalletId(
    walletId: string,
    settings?: {
      where: GetWalletFilters;
      pagination: { skip: number; take: number };
    },
  ) {
    const expensesQuery = this.expenseRepository
      .createQueryBuilder('e')
      .where('e.walletId = :walletId', { walletId: walletId })
      .andWhere('e.description LIKE :d', {
        d: `%${settings?.where?.title || ''}%`,
      })
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
          : [ExpenseType.expense, ExpenseType.income],
      })
      .andWhere('e.schedule = :schedule', { schedule: false });

    if (settings?.where?.category.length > 0) {
      expensesQuery.andWhere('e.category IN(:...category)', {
        category: settings?.where?.category,
      });
    }

    const expenses = await expensesQuery
      .orderBy('e.date', 'DESC')
      .skip(settings?.pagination.skip || 0)
      .take(settings?.pagination.take || 10)
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
  ) {
    const wallet = await this.getWalletIdByUserId(userId);

    let walletId = wallet?.id as string | undefined;

    if (wallet === undefined || wallet === null) {
      const insertResult = await this.walletRepository.insert({
        balance: 0,
        userId,
      });

      walletId = insertResult.identifiers[0].id;
    }

    const insert = await this.expenseRepository.insert({
      amount,
      description,
      walletId: walletId,
      type,
      balanceBeforeInteraction: wallet?.balance as number,
      category,
      date,
      schedule,
    });

    if (schedule && date > new Date())
      return this.expenseRepository.findOne({
        where: { id: insert.identifiers[0].id },
      });

    await this._updateWalletBalance(
      userId,
      amount,
      type === ExpenseType.expense ? ExpenseType.expense : ExpenseType.income,
    );

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

      const updateResult = await this._updateWalletBalance(
        userId,
        amount,
        type === ExpenseType.expense ? ExpenseType.income : ExpenseType.expense,
      );

      return updateResult.affected > 0;
    }
  }

  private async _updateWalletBalance(
    userId: string,
    amount: number,
    type: ExpenseType,
  ) {
    return this.walletRepository.update(
      { userId },
      {
        balance: () =>
          type === ExpenseType.expense
            ? `balance - ${amount}`
            : `balance + ${amount}`,
      },
    );
  }

  async addScheduledTransaction(transaction: ExpenseEntity) {
    await this.walletRepository.update(
      { id: transaction.walletId },
      {
        balance: () =>
          transaction.type === ExpenseType.expense
            ? `balance + ${transaction.amount}`
            : `balance - ${transaction.amount}`,
      },
    );

    return this.expenseRepository.update(
      { id: transaction.id },
      { schedule: false },
    );
  }

  async getScheduledTransactions(date: Date) {
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.expenseRepository.query(
      'SELECT walletId, type, amount, date FROM expense WHERE schedule = 1 AND date >= ? AND date <= ?',
      [date, endOfDay],
    );
  }

  async editExpense(expenseId: string, userId: string, incoming: any) {
    const wallet = await this.walletRepository.findOne({ where: { userId } });
    const exisitng = await this.expenseRepository.findOne({
      where: { id: expenseId },
    });

    if (typeof wallet === 'undefined' || wallet == null)
      throw new Error('Expense doesnt exist');

    const originalBalance =
      exisitng.type === 'income'
        ? wallet.balance - exisitng.amount
        : wallet.balance + exisitng.amount; // restoring balance to state without this expense

    const newBalance =
      incoming.type === 'income'
        ? originalBalance + incoming.amount
        : originalBalance - incoming.amount; // operating on old balance to create new with new expense

    await this.walletRepository.update(
      { userId },
      {
        balance: newBalance,
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

  async getMonthTotalByType(
    type: 'income' | 'expense',
    userId: string,
    month: number,
    year: number,
  ) {
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

  async getStatistics(
    userId: string,
    dateRange: [string, string],
  ): Promise<[WalletStatisticsRange]> {
    const [startDate, endDate] = dateRange;

    // Query database
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
        (SELECT category FROM expense WHERE walletId = (SELECT id FROM walletId) AND date >= ? AND date <= ? AND schedule = 0 GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1) AS theMostCommonCategory,
        (SELECT category FROM expense WHERE walletId = (SELECT id FROM walletId) AND date >= ? AND date <= ? AND schedule = 0 GROUP BY category ORDER BY COUNT(*) ASC LIMIT 1) AS theLeastCommonCategory,
        COALESCE((SELECT SUM(amount) FROM expense WHERE walletId = (SELECT id FROM walletId) AND type = 'income' AND date >= ? AND date <= ? AND schedule = 0), 0) AS income,
        COALESCE((SELECT SUM(amount) FROM expense WHERE walletId = (SELECT id FROM walletId) AND type = 'expense' AND date >= ? AND date <= ? AND schedule = 0), 0) AS expense,
        (SELECT balance FROM wallet WHERE userId = ?) AS lastBalance
      FROM expense e
      JOIN walletId w ON e.walletId = w.id
      WHERE e.date >= ? 
        AND e.date <= ? AND e.schedule = 0
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
}

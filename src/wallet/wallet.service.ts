import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ExpenseEntity,
  ExpenseType,
  WalletEntity,
} from 'src/wallet/wallet.entity';
import { Between, Like, MoreThan, Repository } from 'typeorm';
import { GetWalletFilters } from './wallet.schemas';

const dateFilter = (dateRange: GetWalletFilters['date']) => {
  if (dateRange.from && dateRange.to)
    return {
      date: Between(dateRange.from, dateRange.to),
    };

  if (dateRange.from && !dateRange.to)
    return {
      date: MoreThan(dateRange.from),
    };

  if (!dateRange.from && dateRange.to)
    return {
      date: MoreThan(dateRange.to),
    };
};

const amountFilter = (amountRange: GetWalletFilters['amount']) => {
  if (amountRange.from && amountRange.to)
    return {
      amount: Between(amountRange.from, amountRange.to),
    };

  if (amountRange.from && !amountRange.to)
    return {
      amount: MoreThan(amountRange.from),
    };

  if (!amountRange.from && amountRange.to)
    return {
      amount: MoreThan(amountRange.to),
    };
};

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
      where: { userId },
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

  async getWalletByUserId(
    userId: string,
    settings?: {
      where: GetWalletFilters;
    },
  ) {
    const wallet = await this.walletRepository.findOne({
      where: {
        userId,
      },
    });

    const expenses = await this.expenseRepository
      .createQueryBuilder('e')
      .where('e.walletId = :walletId', { walletId: wallet.id })
      .andWhere('e.description LIKE :d', {
        d: `%${settings?.where?.title || ''}%`,
      })

      .andWhere('e.date >= :from', {
        from: settings?.where?.date?.from || '1900-01-01',
      })
      .andWhere('e.date <= :to', {
        to: settings?.where?.date?.to || '2100-01-01',
      })
      .andWhere('e.amount >= :min', { min: settings?.where?.amount?.from || 0 })
      .andWhere('e.amount <= :max', {
        max: settings?.where?.amount?.to || 1000000000,
      })
      .orderBy('e.date','DESC')
      .getMany();

    return {
      ...wallet,
      expenses,
    };
  }

  async createExpense(
    userId: string,
    amount: number,
    description: string,
    type: ExpenseType,
    category: string,
    date: Date,
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
      where: { walletId: (await this.getWalletIdByUserId(userId)).id },
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
      ) AND type = ? AND date >= ? AND date < DATE_ADD(?, INTERVAL 1 MONTH)
    `,
      [userId, type, date, date],
    );

    return expenses[0].total;
  }
}

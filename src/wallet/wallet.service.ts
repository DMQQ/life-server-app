import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ExpenseEntity,
  ExpenseType,
  WalletEntity,
} from 'src/wallet/wallet.entity';
import { Repository } from 'typeorm';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,

    @InjectRepository(ExpenseEntity)
    private readonly expenseRepository: Repository<ExpenseEntity>,
  ) {}

  async editUserWalletBalance(userId: string, amount: number) {
    let wallet = await this.getWalletByUserId(userId);

    if (wallet) {
      await this.walletRepository.update(wallet.id, {
        balance: amount,
      });

      await this.expenseRepository.insert({
        amount: 0,
        description: 'Balance edit',
        date: new Date(),
        walletId: wallet.id,
        type: ExpenseType.income,
        category: 'edit',
      });

      return await this.getWalletByUserId(userId);
    } else {
      await this.walletRepository.insert({
        balance: amount,
        userId,
      });
    }
  }

  async getWalletByUserId(userId: string) {
    return await this.walletRepository.findOne({
      where: { userId },
      relations: ['expenses'],

      order: {
        expenses: {
          date: 'DESC',
        },
      },
    });
  }

  async createExpense(
    userId: string,
    amount: number,
    description: string,
    type: ExpenseType,
    category: string,
  ) {
    const wallet = await this.getWalletByUserId(userId);

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
      date: new Date(),
      walletId: walletId,
      type,
      balanceBeforeInteraction: wallet?.balance as number,
      category,
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
      where: { walletId: (await this.getWalletByUserId(userId)).id },
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
}

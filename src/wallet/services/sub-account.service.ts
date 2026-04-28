import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseEntity, WalletEntity, WalletSubAccount } from '../entities/wallet.entity';
import { ExpenseFactory } from '../factories/expense.factory';
import { CreateSubAccountInput, UpdateSubAccountInput } from '../dto/wallet.dto';
import * as dayjs from 'dayjs';

@Injectable()
export class SubAccountService {
  constructor(
    @InjectRepository(WalletSubAccount)
    private readonly subAccountRepository: Repository<WalletSubAccount>,

    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,

    @InjectRepository(ExpenseEntity)
    private readonly expenseRepository: Repository<ExpenseEntity>,
  ) {}

  async getAll(userId: string): Promise<WalletSubAccount[]> {
    const date = dayjs();
    const wallet = await this.walletRepository.findOne({ where: { userId } });
    const subAccounts = await this.subAccountRepository.find({ where: { walletId: wallet.id } });

    const accountTraffic = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('expense.subAccountId', 'subAccountId')
      .addSelect(`SUM(CASE WHEN expense.type = 'income' THEN expense.amount ELSE 0 END)`, 'income')
      .addSelect(`SUM(CASE WHEN expense.type = 'expense' THEN expense.amount ELSE 0 END)`, 'expense')
      .where('expense.walletId = :walletId', { walletId: wallet.id })
      .andWhere('expense.date >= :startOfMonth', { startOfMonth: date.startOf('month').toDate() })
      .andWhere('expense.date <= :endOfMonth', { endOfMonth: date.endOf('month').toDate() })
      .groupBy('expense.subAccountId')
      .getRawMany();

    const trafficMap = accountTraffic.reduce((acc, curr) => {
      acc[curr.subAccountId] = {
        income: parseFloat(curr.income) || 0,
        expense: parseFloat(curr.expense) || 0,
      };
      return acc;
    }, {});

    return subAccounts.map((account) => ({
      ...account,
      income: trafficMap[account.id]?.income || 0,
      expense: trafficMap[account.id]?.expense || 0,
    }));
  }

  async create(userId: string, input: CreateSubAccountInput): Promise<WalletSubAccount> {
    const wallet = await this.walletRepository.findOne({ where: { userId } });
    await this.getOrCreateDefaultAccount(wallet.id, wallet.balance);

    const result = await this.subAccountRepository.insert({
      ...input,
      walletId: wallet.id,
      isDefault: false,
      balance: input.balance ?? 0,
    });

    await this.syncWalletBalance(wallet.id);
    return this.subAccountRepository.findOne({ where: { id: result.identifiers[0].id } });
  }

  async update(id: string, input: UpdateSubAccountInput): Promise<WalletSubAccount> {
    await this.subAccountRepository.update({ id }, input);
    if (input.balance !== undefined) {
      const account = await this.subAccountRepository.findOne({ where: { id } });
      await this.syncWalletBalance(account.walletId);
    }
    return this.subAccountRepository.findOne({ where: { id } });
  }

  async delete(id: string): Promise<boolean> {
    const account = await this.subAccountRepository.findOne({ where: { id } });
    if (account?.isDefault) throw new Error('Cannot delete the General account');

    const general = await this.subAccountRepository.findOne({
      where: { walletId: account.walletId, isDefault: true },
    });

    if (general) {
      await this.expenseRepository.update({ subAccountId: id }, { subAccountId: general.id });
      await this.subAccountRepository.update({ id: general.id }, { balance: () => `balance + ${account.balance}` });
    } else {
      await this.expenseRepository.update({ subAccountId: id }, { subAccountId: null });
    }

    const result = await this.subAccountRepository.delete({ id });
    if (general) await this.syncWalletBalance(account.walletId);
    return result.affected > 0;
  }

  async transfer(fromId: string, toId: string, amount: number): Promise<{ from: string; to: string; amount: number }> {
    const [from, to] = await Promise.all([
      this.subAccountRepository.findOneOrFail({ where: { id: fromId } }),
      this.subAccountRepository.findOneOrFail({ where: { id: toId } }),
    ]);

    if (from.walletId !== to.walletId) throw new Error('Sub-accounts must belong to the same wallet');
    if (from.balance < amount) throw new Error('Insufficient balance');

    const wallet = await this.walletRepository.findOne({ where: { id: from.walletId } });

    await Promise.all([
      this.subAccountRepository.update({ id: fromId }, { balance: () => `balance - ${amount}` }),
      this.subAccountRepository.update({ id: toId }, { balance: () => `balance + ${amount}` }),
    ]);

    const transferExpense = ExpenseFactory.createTransferExpense({
      walletId: from.walletId,
      amount,
      fromName: from.name,
      toName: to.name,
      subAccountId: fromId,
      balanceBeforeInteraction: wallet?.balance,
    });

    await this.expenseRepository.insert(transferExpense);

    return { from: fromId, to: toId, amount };
  }

  async getOrCreateDefaultAccount(walletId: string, initialBalance = 0): Promise<WalletSubAccount> {
    let general = await this.subAccountRepository.findOne({ where: { walletId, isDefault: true } });
    if (!general) {
      const result = await this.subAccountRepository.insert({
        walletId,
        name: 'General',
        isDefault: true,
        balance: initialBalance,
        icon: 'bank',
        color: '#7B84FF',
      });
      general = await this.subAccountRepository.findOne({ where: { id: result.identifiers[0].id } });
    }
    return general;
  }

  async syncWalletBalance(walletId: string): Promise<void> {
    await this.walletRepository.query(
      `UPDATE wallet SET balance = (SELECT COALESCE(SUM(balance), 0) FROM wallet_sub_account WHERE walletId = ?) WHERE id = ?`,
      [walletId, walletId],
    );
  }
}

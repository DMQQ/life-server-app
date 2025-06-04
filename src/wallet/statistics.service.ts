import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExpenseEntity, WalletEntity } from './wallet.entity';
import { Repository } from 'typeorm';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(WalletEntity) private walletEntity: Repository<WalletEntity>,

    @InjectRepository(ExpenseEntity) private expenseEntity: Repository<ExpenseEntity>,
  ) {}

  async getWalletId(userId: string) {
    const wallet = await this.walletEntity.findOne({
      where: { userId },
    });

    if (!wallet) {
      throw new Error('Wallet not found for user');
    }

    return wallet.id;
  }

  /**
   * Returns legend structure for charts screen in mobile app
   */
  async legend(userId: string, startDate: string, endDate: string, displayMode: 'general' | 'detailed' = 'detailed') {
    try {
      const walletId = await this.getWalletId(userId);

      if (!startDate || !endDate) {
        throw new Error('Start date and end date are required');
      }

      const grandTotalResult = await this.expenseEntity
        .createQueryBuilder('expense')
        .select('SUM(expense.amount)', 'grandTotal')
        .where('expense.walletId = :walletId', { walletId })
        .andWhere('expense.date BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .getRawOne();

      const grandTotal = parseFloat(grandTotalResult.grandTotal) || 0;

      const categoryExpression =
        displayMode === 'general' ? 'SUBSTRING_INDEX(expense.category, ":", 1)' : 'expense.category';

      const query = this.expenseEntity
        .createQueryBuilder('expense')
        .select(categoryExpression, 'category')
        .addSelect('COUNT(expense.amount)', 'count')
        .addSelect('SUM(expense.amount)', 'total')
        .addSelect('ROUND((SUM(expense.amount) / :grandTotal) * 100, 2)', 'percentage')
        .where('expense.walletId = :walletId', { walletId })
        .andWhere('expense.date BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .andWhere("expense.type = 'expense'")
        .setParameter('grandTotal', grandTotal)
        .groupBy(categoryExpression)
        .orderBy('total', 'DESC');

      return query.getRawMany();
    } catch (error) {
      console.log(error, userId, startDate, endDate);
      return [];
    }
  }

  async dayOfWeek(userId: string, startDate: string, endDate: string) {
    const walletId = await this.getWalletId(userId);

    if (!walletId) {
      throw new Error('Wallet not found');
    }

    const basicStats = await this.expenseEntity
      .createQueryBuilder('expense')
      .select([
        'COUNT(expense.id) as count',
        'SUM(expense.amount) as total',
        'AVG(expense.amount) as avg',
        'DAYOFWEEK(expense.date) as day',
      ])
      .where('expense.walletId = :walletId', { walletId })
      .andWhere('expense.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere("expense.type = 'expense'")
      .groupBy('day')
      .getRawMany();

    const results = await Promise.all(
      basicStats.map(async (stat) => {
        const median = await this.getMedianForDay(walletId, startDate, endDate, stat.day);
        return { ...stat, median, day: Number(stat.day) - 1 };
      }),
    );

    const sorted = results.sort((a, b) => a.day - b.day);
    sorted.push({ ...sorted.shift(), day: 7 });

    return sorted;
  }

  private async getMedianForDay(walletId: string, startDate: string, endDate: string, day: number) {
    const amounts = await this.expenseEntity
      .createQueryBuilder('expense')
      .select('expense.amount')
      .where('expense.walletId = :walletId', { walletId })
      .andWhere('expense.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere("expense.type = 'expense'")
      .andWhere('DAYOFWEEK(expense.date) = :day', { day })
      .orderBy('expense.amount')
      .getMany();

    if (amounts.length === 0) return 0;

    const mid = Math.floor(amounts.length / 2);
    return amounts.length % 2 === 0 ? (amounts[mid - 1].amount + amounts[mid].amount) / 2 : amounts[mid].amount;
  }
}

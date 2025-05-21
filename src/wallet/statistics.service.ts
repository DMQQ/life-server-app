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

  /**
   * Returns legend structure for charts screen in mobile app
   */
  async legend(userId: string, startDate: Date, endDate: Date, displayMode: 'general' | 'detailed' = 'detailed') {
    const wallet = await this.walletEntity.findOne({
      where: { userId },
    });

    if (!wallet) {
      throw new Error('Wallet not found for user');
    }

    const grandTotalResult = await this.expenseEntity
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'grandTotal')
      .where('expense.walletId = :walletId', { walletId: wallet.id })
      .andWhere('expense.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getRawOne();

    const grandTotal = parseFloat(grandTotalResult.grandTotal) || 0;

    const query = this.expenseEntity
      .createQueryBuilder('expense')
      .select(displayMode === 'general' ? 'SUBSTRING_INDEX(expense.category, ":", 1)' : 'expense.category', 'category')
      .addSelect('COUNT(expense.amount)', 'count')
      .addSelect('SUM(expense.amount)', 'total')
      .addSelect('ROUND((SUM(expense.amount) / :grandTotal) * 100, 2)', 'percentage')
      .where('expense.walletId = :walletId', { walletId: wallet.id })
      .andWhere('expense.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere("expense.type = 'expense'")
      .setParameter('grandTotal', grandTotal)
      .groupBy('category')
      .orderBy('total', 'DESC');

    return query.getRawMany();
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExpenseEntity, LimitRange, WalletEntity, WalletLimits } from '../entities/wallet.entity';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(WalletEntity) private walletEntity: Repository<WalletEntity>,

    @InjectRepository(ExpenseEntity) private expenseEntity: Repository<ExpenseEntity>,

    @InjectRepository(WalletLimits) private limitsEntity: Repository<WalletLimits>,
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

  async spendingsByDay(userId: string, startDate: string, endDate: string) {
    const walletId = await this.getWalletId(userId);

    return (
      await this.expenseEntity
        .createQueryBuilder('exp')
        .select(['SUM(exp.amount) as total', 'exp.date as date'])
        .andWhere('exp.date BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .andWhere("exp.type = 'expense'")
        .andWhere('exp.walletId = :walletId', { walletId })
        .groupBy('date')
        .getRawMany()
    ).map((e) => ({
      ...e,
      day: dayjs(e.date).format('DD'),
    }));
  }

  async zeroExpensesDays(userId: string, startDate: string, endDate: string) {
    const walletId = await this.getWalletId(userId);

    const query = await this.expenseEntity.query(
      `WITH RECURSIVE date_range AS (
        SELECT ? as date_col
        UNION ALL
        SELECT date_col + INTERVAL 1 DAY
        FROM date_range
        WHERE date_col < ?
      )
      SELECT dr.date_col as expense_date
      FROM date_range dr
      LEFT JOIN expense e ON DATE(e.date) = dr.date_col AND e.walletId = ?
      WHERE e.id IS NULL
      ORDER BY dr.date_col;`,
      [startDate, endDate, walletId],
    );

    return query.map((q) => q?.expense_date);
  }

  async avgSpendingsInRange(userId: string, startDate: string, endDate: string) {
    const walletId = await this.getWalletId(userId);

    if (!walletId) {
      throw new Error('Wallet not found');
    }

    const result = await this.expenseEntity
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.walletId = :walletId', { walletId })
      .andWhere('expense.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere("expense.type = 'expense'")
      .getRawOne();

    const daysInRange = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;

    return result.total / daysInRange;
  }

  async noSpendingsStreaks(userId: string, startDate: string, endDate: string) {
    const dates = await this.zeroExpensesDays(userId, startDate, endDate);
    if (dates.length === 0) {
      return [];
    }

    const streaks: { start: string; end: string; length: number }[] = [];
    let currentStreak: { start: string; end: string; length: number } | null = null;

    for (let i = 0; i < dates.length; i++) {
      const currentDate = dayjs(dates[i]);
      const nextDate = dayjs(dates[i + 1]);

      if (currentStreak) {
        if (nextDate.diff(currentDate, 'day') === 1) {
          currentStreak.end = nextDate.format('YYYY-MM-DD');
          currentStreak.length++;
        } else {
          streaks.push(currentStreak);
          currentStreak = null;
        }
      }

      if (!currentStreak) {
        currentStreak = {
          start: currentDate.format('YYYY-MM-DD'),
          end: currentDate.format('YYYY-MM-DD'),
          length: 1,
        };
      }
    }

    if (currentStreak) {
      streaks.push(currentStreak);
    }

    return streaks
      .filter((d) => d.length > 1)
      .map((streak) => ({
        ...streak,
        start: dayjs(streak.start).format('YYYY-MM-DD'),
        end: dayjs(streak.end).format('YYYY-MM-DD'),
      }));
  }

  async spendingsLimits(userId: string, startDate: string, endDate: string) {
    const wallet = await this.walletEntity.findOne({
      where: { userId },
    });

    const walletId = wallet?.id;
    const generalLimit = wallet.income * (wallet.monthlyPercentageTarget / 100);

    const limits = await this.limitsEntity.find({
      where: { walletId, type: LimitRange.monthly },
    });

    const monthlyExpenses = await this.expenseEntity.query(
      `SELECT 
      DATE_FORMAT(date, '%Y-%m') as month,
      SUBSTRING_INDEX(category, ':', 1) as main_category,
      SUM(amount) as total
    FROM expense 
    WHERE walletId = ? 
      AND date BETWEEN ? AND ?
      AND type = 'expense'
      AND category IS NOT NULL
    GROUP BY DATE_FORMAT(date, '%Y-%m'), SUBSTRING_INDEX(category, ':', 1)
    ORDER BY month, main_category`,
      [walletId, startDate, endDate],
    );

    const monthlyTotals = await this.expenseEntity.query(
      `SELECT 
      DATE_FORMAT(date, '%Y-%m') as month,
      SUM(amount) as total
    FROM expense 
    WHERE walletId = ? 
      AND date BETWEEN ? AND ?
      AND type = 'expense'
    GROUP BY DATE_FORMAT(date, '%Y-%m')
    ORDER BY month`,
      [walletId, startDate, endDate],
    );

    const limitsMap = limits.reduce((acc, limit) => {
      acc[limit.category] = limit.amount;
      return acc;
    }, {});

    const results = monthlyTotals.map((monthTotal) => {
      const monthExpenses = monthlyExpenses
        .filter((exp) => exp.month === monthTotal.month)
        .filter((exp) => limitsMap[exp.main_category])
        .map((exp) => ({
          category: exp.main_category,
          spent: parseFloat(exp.total),
          limit: limitsMap[exp.main_category],
          exceeded: parseFloat(exp.total) > limitsMap[exp.main_category],
        }));

      return {
        month: monthTotal.month,
        totalSpent: parseFloat(monthTotal.total),
        generalLimit,
        generalLimitExceeded: parseFloat(monthTotal.total) > generalLimit,
        categories: monthExpenses,
      };
    });

    return results;
  }
}

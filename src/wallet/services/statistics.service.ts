import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import { Repository } from 'typeorm';
import { ExpenseEntity, LimitRange, WalletEntity, WalletLimits } from '../entities/wallet.entity';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(WalletEntity) private walletEntity: Repository<WalletEntity>,

    @InjectRepository(ExpenseEntity) private expenseEntity: Repository<ExpenseEntity>,

    @InjectRepository(WalletLimits) private limitsEntity: Repository<WalletLimits>,
  ) {}

  /**
   * Returns legend structure for charts screen in mobile app
   */
  async legend(walletId: string, startDate: string, endDate: string, displayMode: 'general' | 'detailed' = 'detailed') {
    try {
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
      return [];
    }
  }

  async dayOfWeek(walletId: string, startDate: string, endDate: string) {
    const basicStats = await this.expenseEntity
      .createQueryBuilder('expense')
      .select([
        'COUNT(expense.id) as count',
        'SUM(expense.amount) as total',
        'AVG(expense.amount) as avg',
        'WEEKDAY(expense.date) + 1 as day',
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
        return { ...stat, median, day: Number(stat.day) };
      }),
    );

    const dayMap = new Map(results.map((r) => [r.day, r]));

    return Array.from(
      { length: 7 },
      (_, i) => dayMap.get(i + 1) || { count: 0, total: 0, avg: 0, median: 0, day: i + 1 },
    );
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

  async spendingsByDay(walletId: string, startDate: string, endDate: string) {
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

  async zeroExpensesDays(walletId: string, startDate: string, endDate: string) {
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

  async avgSpendingsInRange(walletId: string, startDate: string, endDate: string) {
    const result = await this.expenseEntity
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.walletId = :walletId', { walletId })
      .andWhere('DATE(expense.date) BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere("expense.type = 'expense'")
      .getRawOne();

    const daysInRange = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;

    return result.total / daysInRange;
  }

  async noSpendingsStreaks(walletId: string, startDate: string, endDate: string) {
    const dates = await this.zeroExpensesDays(walletId, startDate, endDate);
    if (dates.length === 0) {
      return [];
    }

    const streaks: { start: string; end: string; length: number }[] = [];

    console.log('Zero expense dates:', dates);

    let currentStreak = { start: dates[0], end: dates[0], length: 1 };

    for (let i = 1; i < dates.length; i++) {
      const currentDate = dayjs(dates[i]);
      const previousDate = dayjs(dates[i - 1]);

      if (currentDate.diff(previousDate, 'day') === 1) {
        currentStreak.end = dates[i];
        currentStreak.length++;
      } else {
        streaks.push(currentStreak);
        currentStreak = { start: dates[i], end: dates[i], length: 1 };
      }
    }

    streaks.push(currentStreak);

    return streaks.filter((streak) => streak.length > 1);
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

  async dailyBreakdownByCategory(walletId: string, startDate: string, endDate: string) {
    const result = await this.expenseEntity
      .createQueryBuilder('exp')
      .select([
        'DATE(exp.date) as date',
        'exp.category as category',
        'SUM(exp.amount) as total',
      ])
      .andWhere('exp.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere("exp.type = 'expense'")
      .andWhere('exp.walletId = :walletId', { walletId })
      .groupBy('DATE(exp.date), exp.category')
      .orderBy('DATE(exp.date)', 'ASC')
      .getRawMany();

    // Group by date
    const groupedByDate = result.reduce((acc, item) => {
      const date = item.date;
      if (!acc[date]) {
        acc[date] = {
          date,
          dayOfWeek: dayjs(date).format('ddd'),
          categories: [],
          total: 0,
        };
      }
      acc[date].categories.push({
        category: item.category,
        amount: parseFloat(item.total),
      });
      acc[date].total += parseFloat(item.total);
      return acc;
    }, {});

    return Object.values(groupedByDate);
  }
}

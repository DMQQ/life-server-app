import * as dayjs from 'dayjs';
import { AiTool, ToolContext } from './base.tool';
import { WalletEntity, WalletLimits, LimitRange } from 'src/wallet/entities/wallet.entity';

interface DateRange {
  where: { startDate: string; endDate: string };
}

abstract class WalletStatsTool extends AiTool {
  readonly fields = { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' };
  get schema() {
    return `${this.name}(params) — ${this.description} | params: { where: { startDate, endDate } }`;
  }
}

export class LegendTool extends WalletStatsTool {
  readonly name = 'legend';
  readonly description = 'Category spending breakdown — use for pie/donut charts';

  async run(params: DateRange, ctx: ToolContext) {
    const { startDate, endDate } = params.where ?? {};
    return ctx.dataSource.query(
      `SELECT SUBSTRING_INDEX(category, ':', 1) AS category,
              COUNT(*) AS count,
              ROUND(SUM(amount), 2) AS total,
              ROUND(SUM(amount) / (
                SELECT SUM(amount) FROM expense
                WHERE walletId = ? AND date BETWEEN ? AND ? AND type = 'expense'
              ) * 100, 2) AS percentage
       FROM expense
       WHERE walletId = ? AND date BETWEEN ? AND ? AND type = 'expense'
       GROUP BY SUBSTRING_INDEX(category, ':', 1)
       ORDER BY total DESC`,
      [ctx.walletId, startDate, endDate, ctx.walletId, startDate, endDate],
    );
  }
}

export class DayOfWeekTool extends WalletStatsTool {
  readonly name = 'dayOfWeek';
  readonly description = 'Average spending per day of week with median — use for bar charts';

  async run(params: DateRange, ctx: ToolContext) {
    const { startDate, endDate } = params.where ?? {};

    const basicStats: any[] = await ctx.dataSource.query(
      `SELECT WEEKDAY(MIN(date)) + 1 AS day,
              COUNT(id) AS count,
              ROUND(SUM(amount), 2) AS total,
              ROUND(AVG(amount), 2) AS avg
       FROM expense
       WHERE walletId = ? AND date BETWEEN ? AND ? AND type = 'expense'
       GROUP BY WEEKDAY(date)
       ORDER BY day`,
      [ctx.walletId, startDate, endDate],
    );

    const withMedian = await Promise.all(
      basicStats.map(async (stat) => {
        const amounts: any[] = await ctx.dataSource.query(
          `SELECT amount FROM expense
           WHERE walletId = ? AND date BETWEEN ? AND ? AND type = 'expense'
             AND WEEKDAY(date) + 1 = ?
           ORDER BY amount`,
          [ctx.walletId, startDate, endDate, stat.day],
        );
        const vals = amounts.map((r) => parseFloat(r.amount));
        const mid = Math.floor(vals.length / 2);
        const median =
          vals.length === 0 ? 0 : vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
        return { ...stat, median, day: Number(stat.day) };
      }),
    );

    const dayMap = new Map(withMedian.map((r) => [r.day, r]));
    return Array.from(
      { length: 7 },
      (_, i) => dayMap.get(i + 1) || { count: 0, total: 0, avg: 0, median: 0, day: i + 1 },
    );
  }
}

export class DailySpendingsTool extends WalletStatsTool {
  readonly name = 'dailySpendings';
  readonly description = 'Daily spending totals over a range — use for line charts';

  async run(params: DateRange, ctx: ToolContext) {
    const { startDate, endDate } = params.where ?? {};
    const rows: any[] = await ctx.dataSource.query(
      `SELECT DATE(date) AS date, ROUND(SUM(amount), 2) AS total
       FROM expense
       WHERE walletId = ? AND date BETWEEN ? AND ? AND type = 'expense'
       GROUP BY DATE(date)
       ORDER BY date ASC`,
      [ctx.walletId, startDate, endDate],
    );
    return rows.map((r) => ({ ...r, day: (dayjs as any)(r.date).format('DD') }));
  }
}

export class DailyBreakdownTool extends WalletStatsTool {
  readonly name = 'dailyBreakdown';
  readonly description = 'Spending per day split by category — use for stacked bar charts';

  async run(params: DateRange, ctx: ToolContext) {
    const { startDate, endDate } = params.where ?? {};
    const rows: any[] = await ctx.dataSource.query(
      `SELECT DATE(date) AS date, category, ROUND(SUM(amount), 2) AS total
       FROM expense
       WHERE walletId = ? AND date BETWEEN ? AND ? AND type = 'expense'
       GROUP BY DATE(date), category
       ORDER BY DATE(date) ASC`,
      [ctx.walletId, startDate, endDate],
    );

    const groupedByDate: Record<string, any> = {};
    for (const item of rows) {
      const dateStr = typeof item.date === 'string' ? item.date.split('T')[0] : (dayjs as any)(item.date).format('YYYY-MM-DD');
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = {
          date: dateStr,
          dayOfWeek: (dayjs as any)(dateStr).format('ddd'),
          categories: [],
          total: 0,
        };
      }
      groupedByDate[dateStr].categories.push({ category: item.category, amount: parseFloat(item.total) });
      groupedByDate[dateStr].total += parseFloat(item.total);
    }

    const start = (dayjs as any)(startDate);
    const end = (dayjs as any)(endDate);
    const allDays: any[] = [];
    let cur = start;
    while (cur.isBefore(end) || cur.isSame(end, 'day')) {
      const d = cur.format('YYYY-MM-DD');
      allDays.push(groupedByDate[d] || { date: d, dayOfWeek: cur.format('ddd'), categories: [], total: 0 });
      cur = cur.add(1, 'day');
    }
    return allDays;
  }
}

export class ZeroExpenseDaysTool extends WalletStatsTool {
  readonly name = 'zeroExpenseDays';
  readonly description = 'Days with no spending + streaks + estimated savings — use for insight cards';

  async run(params: DateRange, ctx: ToolContext) {
    const { startDate, endDate } = params.where ?? {};

    const zeroDays: any[] = await ctx.dataSource.query(
      `WITH RECURSIVE date_range AS (
         SELECT ? AS date_col
         UNION ALL
         SELECT date_col + INTERVAL 1 DAY FROM date_range WHERE date_col < ?
       )
       SELECT dr.date_col AS expense_date
       FROM date_range dr
       LEFT JOIN expense e ON DATE(e.date) = dr.date_col AND e.walletId = ?
       WHERE e.id IS NULL
       ORDER BY dr.date_col`,
      [startDate, endDate, ctx.walletId],
    );

    const avgResult: any[] = await ctx.dataSource.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expense
       WHERE walletId = ? AND DATE(date) BETWEEN ? AND ? AND type = 'expense'`,
      [ctx.walletId, startDate, endDate],
    );

    const daysInRange = (dayjs as any)(endDate).diff((dayjs as any)(startDate), 'day') + 1;
    const avg = parseFloat(avgResult[0]?.total ?? '0') / daysInRange;

    const dates = zeroDays.map((r: any) => r.expense_date as string);
    const streaks: { start: string; end: string; length: number }[] = [];
    if (dates.length > 0) {
      let cur = { start: dates[0], end: dates[0], length: 1 };
      for (let i = 1; i < dates.length; i++) {
        if ((dayjs as any)(dates[i]).diff((dayjs as any)(dates[i - 1]), 'day') === 1) {
          cur.end = dates[i];
          cur.length++;
        } else {
          if (cur.length > 1) streaks.push(cur);
          cur = { start: dates[i], end: dates[i], length: 1 };
        }
      }
      if (cur.length > 1) streaks.push(cur);
    }

    return { days: dates, avg: Math.round(avg * 100) / 100, streak: streaks, saved: Math.round(dates.length * avg * 100) / 100 };
  }
}

export class SpendingsLimitsTool extends WalletStatsTool {
  readonly name = 'spendingsLimits';
  readonly description = 'Monthly spending vs category limits — use for limit/budget cards';

  async run(params: DateRange, ctx: ToolContext) {
    const { startDate, endDate } = params.where ?? {};

    const wallet = await ctx.dataSource.getRepository(WalletEntity).findOne({ where: { id: ctx.walletId } });
    if (!wallet) return [];

    const generalLimit = wallet.income * (wallet.monthlyPercentageTarget / 100);
    const limits = await ctx.dataSource.getRepository(WalletLimits).find({
      where: { walletId: ctx.walletId, type: LimitRange.monthly },
    });

    const monthlyExpenses: any[] = await ctx.dataSource.query(
      `SELECT DATE_FORMAT(date, '%Y-%m') AS month,
              SUBSTRING_INDEX(category, ':', 1) AS main_category,
              SUM(amount) AS total
       FROM expense
       WHERE walletId = ? AND date BETWEEN ? AND ? AND type = 'expense' AND category IS NOT NULL
       GROUP BY DATE_FORMAT(date, '%Y-%m'), SUBSTRING_INDEX(category, ':', 1)
       ORDER BY month, main_category`,
      [ctx.walletId, startDate, endDate],
    );

    const monthlyTotals: any[] = await ctx.dataSource.query(
      `SELECT DATE_FORMAT(date, '%Y-%m') AS month, SUM(amount) AS total
       FROM expense
       WHERE walletId = ? AND date BETWEEN ? AND ? AND type = 'expense'
       GROUP BY DATE_FORMAT(date, '%Y-%m')
       ORDER BY month`,
      [ctx.walletId, startDate, endDate],
    );

    const limitsMap = limits.reduce((acc: Record<string, number>, l) => { acc[l.category] = l.amount; return acc; }, {});

    return monthlyTotals.map((mt) => ({
      month: mt.month,
      totalSpent: parseFloat(mt.total),
      generalLimit,
      generalLimitExceeded: parseFloat(mt.total) > generalLimit,
      categories: monthlyExpenses
        .filter((e) => e.month === mt.month && limitsMap[e.main_category])
        .map((e) => ({
          category: e.main_category,
          spent: parseFloat(e.total),
          limit: limitsMap[e.main_category],
          exceeded: parseFloat(e.total) > limitsMap[e.main_category],
        })),
    }));
  }
}

export class BalancePredictionTool extends WalletStatsTool {
  readonly name = 'balancePrediction';
  readonly description = 'Projected wallet balance for next 1/2/3/6/12 months based on spending history';

  async run(params: DateRange, ctx: ToolContext) {
    const { endDate } = params.where ?? {};

    const wallet = await ctx.dataSource.getRepository(WalletEntity).findOne({ where: { id: ctx.walletId } });
    const currentBalance = wallet?.balance || 0;
    const configuredIncome = wallet?.income || 0;

    const fromDate = (dayjs as any)().subtract(12, 'months').startOf('month').format('YYYY-MM-DD');
    const toDate = (dayjs as any)().format('YYYY-MM-DD');

    const monthlyData: any[] = await ctx.dataSource.query(
      `SELECT MONTH(date) AS month, YEAR(date) AS year,
              SUM(CASE WHEN type = 'expense' THEN amount * (1 - COALESCE(spontaneousRate, 0)/100) ELSE 0 END) AS totalExpense,
              SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS totalIncome
       FROM expense
       WHERE walletId = ? AND date >= ? AND date <= ?
       GROUP BY MONTH(date), YEAR(date)
       ORDER BY year ASC, month ASC`,
      [ctx.walletId, fromDate, toDate],
    );

    const totalMonths = monthlyData.length || 1;
    const { totalIncome, totalExpense } = monthlyData.reduce(
      (acc, d) => { acc.totalIncome += parseFloat(d.totalIncome) || 0; acc.totalExpense += parseFloat(d.totalExpense) || 0; return acc; },
      { totalIncome: 0, totalExpense: 0 },
    );

    const avgMonthlyIncome = totalIncome > 0 ? totalIncome / totalMonths : configuredIncome;
    const avgMonthlyExpense = totalExpense / totalMonths;
    const avgMonthlyNet = avgMonthlyIncome - avgMonthlyExpense;

    return {
      currentBalance,
      avgMonthlyIncome: Math.round(avgMonthlyIncome * 100) / 100,
      avgMonthlyExpense: Math.round(avgMonthlyExpense * 100) / 100,
      avgMonthlyNet: Math.round(avgMonthlyNet * 100) / 100,
      historicalMonths: totalMonths,
      projections: [1, 2, 3, 6, 12].map((monthsAhead) => {
        const d = (dayjs as any)(endDate ?? toDate).add(monthsAhead, 'month');
        return {
          month: d.month() + 1,
          year: d.year(),
          monthsAhead,
          projectedBalance: Math.round((currentBalance + avgMonthlyNet * monthsAhead) * 100) / 100,
          avgMonthlyIncome: Math.round(avgMonthlyIncome * 100) / 100,
          avgMonthlyExpense: Math.round(avgMonthlyExpense * 100) / 100,
          avgMonthlyNet: Math.round(avgMonthlyNet * 100) / 100,
        };
      }),
    };
  }
}

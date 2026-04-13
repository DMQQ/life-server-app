import { AiTool, ToolContext } from './base.tool';

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
  readonly description = 'Average spending per day of week — use for bar charts';

  async run(params: DateRange, ctx: ToolContext) {
    const { startDate, endDate } = params.where ?? {};
    return ctx.dataSource.query(
      `SELECT DAYOFWEEK(t.date) AS day, ROUND(SUM(t.daily_sum), 2) AS total,
              ROUND(AVG(t.daily_sum), 2) AS avg, COUNT(*) AS count
       FROM (
         SELECT date, SUM(amount) AS daily_sum
         FROM expense
         WHERE walletId = ? AND date BETWEEN ? AND ? AND type = 'expense'
         GROUP BY date
       ) t
       GROUP BY DAYOFWEEK(t.date)
       ORDER BY day`,
      [ctx.walletId, startDate, endDate],
    );
  }
}

export class DailySpendingsTool extends WalletStatsTool {
  readonly name = 'dailySpendings';
  readonly description = 'Daily spending totals over a range — use for line charts';

  async run(params: DateRange, ctx: ToolContext) {
    const { startDate, endDate } = params.where ?? {};
    return ctx.dataSource.query(
      `SELECT DATE(date) AS date, DAYNAME(MIN(date)) AS day, ROUND(SUM(amount), 2) AS total
       FROM expense
       WHERE walletId = ? AND date BETWEEN ? AND ? AND type = 'expense'
       GROUP BY DATE(date)
       ORDER BY date ASC`,
      [ctx.walletId, startDate, endDate],
    );
  }
}

export class DailyBreakdownTool extends WalletStatsTool {
  readonly name = 'dailyBreakdown';
  readonly description = 'Spending per day split by category — use for stacked bar charts';

  async run(params: DateRange, ctx: ToolContext) {
    const { startDate, endDate } = params.where ?? {};
    return ctx.dataSource.query(
      `SELECT DATE(date) AS date, SUBSTRING_INDEX(category, ':', 1) AS category,
              ROUND(SUM(amount), 2) AS total
       FROM expense
       WHERE walletId = ? AND date BETWEEN ? AND ? AND type = 'expense'
       GROUP BY DATE(date), SUBSTRING_INDEX(category, ':', 1)
       ORDER BY date ASC`,
      [ctx.walletId, startDate, endDate],
    );
  }
}

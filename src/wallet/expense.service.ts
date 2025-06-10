import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExpenseEntity, ExpenseLocationEntity, ExpenseSubExpense, WalletEntity } from './wallet.entity';
import { Between, Like, Repository } from 'typeorm';
import * as dayjs from 'dayjs';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(ExpenseLocationEntity)
    private locationEntity: Repository<ExpenseLocationEntity>,

    @InjectRepository(ExpenseEntity)
    private expenseEntity: Repository<ExpenseEntity>,

    @InjectRepository(ExpenseSubExpense)
    private subExpenseRepository: Repository<ExpenseSubExpense>,

    @InjectRepository(WalletEntity)
    private walletRepository: Repository<WalletEntity>,
  ) {}

  async getOne(id: string) {
    return this.expenseEntity.findOne({
      where: {
        id,
      },
      relations: ['location', 'subscription', 'subexpenses', 'files'],
    });
  }

  async queryLocations(query: string, longitude?: number, latitude?: number) {
    return this.locationEntity.find({
      where: {
        ...(query && { name: Like(`%${query}%`) }),

        ...(longitude && {
          longitude: Between(longitude - 0.1, longitude + 0.1),
        }),

        ...(latitude && { latitude: Between(latitude - 0.1, latitude + 0.1) }),
      },
    });
  }

  async createLocation(entity: Partial<ExpenseLocationEntity>) {
    return await this.locationEntity.save({
      ...entity,
    });
  }

  async addExpenseLocation(expenseId: string, locationId: string) {
    return this.expenseEntity.update(
      {
        id: expenseId,
      },
      {
        location: locationId as any,
      },
    );
  }

  async createSubExpense(expenseId: string, subExpenseData: Partial<ExpenseSubExpense>) {
    const newSubExpense = this.subExpenseRepository.create({
      ...subExpenseData,
      expenseId,
    });
    return await this.subExpenseRepository.save(newSubExpense);
  }

  async getSubExpenses(expenseId: string) {
    return this.subExpenseRepository.find({
      where: { expenseId },
    });
  }

  async getSubExpenseById(id: string) {
    return this.subExpenseRepository.findOne({
      where: { id },
    });
  }

  async updateSubExpense(id: string, subExpenseData: Partial<ExpenseSubExpense>) {
    await this.subExpenseRepository.update(id, subExpenseData);
    return this.getSubExpenseById(id);
  }

  async deleteSubExpense(id: string) {
    const subExpense = await this.getSubExpenseById(id);
    if (!subExpense) {
      return { success: false, message: 'Sub-expense not found' };
    }

    await this.subExpenseRepository.delete(id);
    return { success: true, message: 'Sub-expense deleted successfully' };
  }

  async getExpenseWithSubExpenses(expenseId: string) {
    return this.expenseEntity.findOne({
      where: { id: expenseId },
      relations: ['subexpenses'],
    });
  }

  async addMultipleSubExpenses(expenseId: string, subExpenses: Partial<ExpenseSubExpense>[]) {
    const subExpensesToSave = subExpenses.map((subExpense) =>
      this.subExpenseRepository.create({
        ...subExpense,
        expenseId,
      }),
    );

    return await this.subExpenseRepository.save(subExpensesToSave);
  }

  async monthlyCategoryComparison(userId: string, months: string[]) {
    const walletId = (await this.walletRepository.findOne({ where: { userId } })).id;
    const query = `
      SELECT category, SUM(amount) as total, AVG(amount) as avg, COUNT(amount) as count FROM expense WHERE walletId = ? AND date BETWEEN ? AND ? AND type = 'expense' GROUP BY category
    `;

    const queryMonth = (month: string) => {
      const start = dayjs(month).startOf('month').format('YYYY-MM-DD');
      const end = dayjs(month).endOf('month').format('YYYY-MM-DD');
      return this.expenseEntity.query(query.trim(), [walletId, start, end]);
    };

    const monthsResponse = await Promise.all(months.map((m) => queryMonth(m)));

    return monthsResponse.map((arr, index) => ({
      //prettier-ignore
      month: ['January','Febuary','March','April','May','June','July','August','September','October','November','December'][dayjs(months[index]).get('month')],
      categories: arr.map((i) => ({ ...i, count: +i.count })),
    }));
  }

  async monthlyHeatMapSpendings(userId: string, months: string[]) {
    const walletId = (await this.walletRepository.findOne({ where: { userId } })).id;

    const query = `
      SELECT DAY(date) AS day_of_month, SUM(amount) AS total_amount, COUNT(amount) as count, AVG(amount) as avg
      FROM expense
      WHERE walletId = ?
        AND date BETWEEN ? AND ?
        AND type = 'expense'
      GROUP BY DAY(date)
      ORDER BY day_of_month
    `.trim();

    const response = await this.expenseEntity.query(query, [walletId, months[0], months[months.length - 1]]);

    const daysMap = {};

    response.forEach((item) => {
      daysMap[item.day_of_month] = {
        dayOfMonth: item.day_of_month,
        totalCount: +item.count,
        totalAmount: item.total_amount,
        averageAmount: +item.avg,
      };
    });

    for (let i = 1; i < 32; i++) {
      if (!daysMap[i]) {
        daysMap[i] = {
          dayOfMonth: i,
          totalCount: 0,
          totalAmount: 0,
          averageAmount: 0,
        };
      }
    }

    return Object.entries(daysMap).map(([_, item]) => item);
  }

  async hourlyHeadMapSpendings(userId: string, months: string[]) {
    const walletId = (await this.walletRepository.findOne({ where: { userId } })).id;

    const query = `
      SELECT HOUR(date) as hour, COUNT(*) as count, AVG(amount) as avg_amount, MIN(amount) as min_amount, MAX(amount) as max_amount,
        STDDEV(amount) as std_deviation, 
        VARIANCE(amount) as variance
      FROM expense 
      WHERE walletId = ?
      AND date BETWEEN ? AND ?
      AND type = 'expense'
      GROUP BY hour
      ORDER BY hour ASC
      
    `;

    const response = await this.expenseEntity.query(query.trim(), [walletId, months[0], months[months.length - 1]]);

    return response.map((r) => ({ ...r, count: +r.count }));
  }

  async getExpenses(userId: string, range: { from: string; to: string }) {
    const walletId = (await this.walletRepository.findOne({ where: { userId } })).id;

    return this.expenseEntity.find({
      where: {
        walletId,
        date: Between(dayjs(range.from).toDate(), dayjs(range.to).toDate()),
      },
    });
  }

  async getDailyInsights(walletId: string, dates: [string, string]) {
    const query = `
      SELECT SUM(amount) as expense_sum, COUNT(*) as transaction_count FROM expense
      WHERE walletId = ?
        AND date >= ? AND date <= ?
        AND type = 'expense'
        AND schedule = 0
    `.trim();

    const response = await this.expenseEntity.query(query, [walletId, ...dates]);

    return response.length > 0 ? response[0] : null;
  }

  async getHourlySpendingPatterns(walletId: string, dateRange: [string, string]) {
    try {
      const [startDate, endDate] = dateRange;

      const query = `
      SELECT 
        HOUR(date) as hour, 
        COUNT(*) as count, 
        SUM(amount) as total_amount, 
        AVG(amount) as avg_amount
      FROM expense 
      WHERE walletId = ?
      AND date BETWEEN ? AND ?
      AND type = 'expense'
      AND schedule = 0
      GROUP BY hour
      ORDER BY hour ASC
    `;

      // Execute the query
      const hourlyData = await this.expenseEntity.query(query, [walletId, startDate, endDate]);

      return hourlyData;
    } catch (error) {
      console.error('Error getting hourly spending patterns:', error);
      return [];
    }
  }

  async getTopCategoryForHour(walletId: string, hour: number, dateRange: [string, string]) {
    try {
      const [startDate, endDate] = dateRange;

      const query = `
      SELECT 
        category, 
        COUNT(*) as category_count
      FROM expense
      WHERE walletId = ?
      AND HOUR(date) = ?
      AND date BETWEEN ? AND ?
      AND type = 'expense'
      AND schedule = 0
      GROUP BY category
      ORDER BY category_count DESC
      LIMIT 1
    `;

      const result = await this.expenseEntity.query(query, [walletId, hour, startDate, endDate]);

      return result && result.length > 0 ? result[0].category : null;
    } catch (error) {
      console.error('Error getting top category for hour:', error);
      return null;
    }
  }

  async getTotalExpensesForPeriod(walletId: string, dateRange: [string, string]) {
    try {
      const [startDate, endDate] = dateRange;

      const query = `
      SELECT 
        SUM(amount) as expense_sum, 
        COUNT(*) as transaction_count
      FROM expense
      WHERE walletId = ?
      AND date BETWEEN ? AND ?
      AND type = 'expense'
      AND schedule = 0
    `;

      const result = await this.expenseEntity.query(query, [walletId, startDate, endDate]);

      return result && result.length > 0 ? result[0] : { expense_sum: 0, transaction_count: 0 };
    } catch (error) {
      console.error('Error getting total expenses for period:', error);
      return { expense_sum: 0, transaction_count: 0 };
    }
  }

  /**
   * Methods to add to your ExpenseService class for the new insights features
   */

  /**
   * Get expenses for a date range grouped by day of week
   * @param walletId Wallet ID
   * @param dateRange Array with start and end date [startDate, endDate]
   * @returns Day of week spending data
   */
  async getSpendingByDayOfWeek(walletId: string, dateRange: [string, string]) {
    try {
      const [startDate, endDate] = dateRange;

      const query = `
      SELECT 
        WEEKDAY(date) as day_of_week, 
        COUNT(*) as count, 
        SUM(amount) as total_amount, 
        AVG(amount) as avg_amount
      FROM expense
      WHERE walletId = ?
        AND date BETWEEN ? AND ?
        AND type = 'expense'
        AND schedule = 0
      GROUP BY day_of_week
      ORDER BY day_of_week
    `;

      const result = await this.expenseEntity.query(query, [walletId, startDate, endDate]);

      return result;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get expenses categorized by period (morning, afternoon, evening, night)
   * @param walletId Wallet ID
   * @param dateRange Array with start and end date [startDate, endDate]
   * @returns Period spending data
   */
  async getSpendingByPeriod(walletId: string, dateRange: [string, string]) {
    try {
      const [startDate, endDate] = dateRange;

      const query = `
      SELECT 
        CASE
          WHEN HOUR(date) BETWEEN 5 AND 11 THEN 'morning'
          WHEN HOUR(date) BETWEEN 12 AND 16 THEN 'afternoon'
          WHEN HOUR(date) BETWEEN 17 AND 21 THEN 'evening'
          ELSE 'night'
        END as period,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount
      FROM expense
      WHERE walletId = ?
        AND date BETWEEN ? AND ?
        AND type = 'expense'
        AND schedule = 0
      GROUP BY period
      ORDER BY 
        CASE period
          WHEN 'morning' THEN 1
          WHEN 'afternoon' THEN 2
          WHEN 'evening' THEN 3
          WHEN 'night' THEN 4
        END
    `;

      const result = await this.expenseEntity.query(query, [walletId, startDate, endDate]);

      return result;
    } catch (error) {
      return [];
    }
  }

  async getMonthlyCategories(walletId: string, months: string[]) {
    try {
      const result = [];

      for (const month of months) {
        const startDate = dayjs(month).startOf('month').format('YYYY-MM-DD');
        const endDate = dayjs(month).endOf('month').format('YYYY-MM-DD');

        const query = `
        SELECT 
          category, 
          SUM(amount) as total, 
          COUNT(*) as count
        FROM expense
        WHERE walletId = ?
          AND date BETWEEN ? AND ?
          AND type = 'expense'
          AND schedule = 0
        GROUP BY category
        ORDER BY total DESC
      `;

        const categories = await this.expenseEntity.query(query, [walletId, startDate, endDate]);

        result.push({
          month: dayjs(month).format('MMMM YYYY'),
          categories: categories || [],
        });
      }

      return result;
    } catch (error) {
      return [];
    }
  }

  async getMonthIncomesAndExpenses(walletId: string, dateRange: [string, string]) {
    try {
      const [startDate, endDate] = dateRange;

      const query = `
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM expense
      WHERE walletId = ?
        AND date BETWEEN ? AND ?
        AND schedule = 0
    `;

      const result = await this.expenseEntity.query(query, [walletId, startDate, endDate]);

      return result && result.length > 0
        ? {
            income: parseFloat(result[0].income) || 0,
            expense: parseFloat(result[0].expense) || 0,
          }
        : {
            income: 0,
            expense: 0,
          };
    } catch (error) {
      return {
        income: 0,
        expense: 0,
      };
    }
  }

  async getExpensesForPeriod(walletId: string, dateRange: [string, string]) {
    try {
      const [startDate, endDate] = dateRange;

      const query = `
      SELECT 
        id,
        amount,
        description, 
        date,
        type,
        category
      FROM expense
      WHERE walletId = ?
        AND date BETWEEN ? AND ?
        AND schedule = 0
        AND type = 'expense'
      ORDER BY date DESC
    `;

      return await this.expenseEntity.query(query, [walletId, startDate, endDate]);
    } catch (error) {
      return [];
    }
  }

  async getCategoryBreakdown(walletId: string, dateRange: [string, string]) {
    try {
      const [startDate, endDate] = dateRange;

      const query = `
      SELECT 
        category,
        SUM(amount) as total,
        COUNT(*) as count,
        AVG(amount) as average,
        MIN(date) as first_date,
        MAX(date) as last_date
      FROM expense
      WHERE walletId = ?
        AND date BETWEEN ? AND ?
        AND type = 'expense'
        AND schedule = 0
      GROUP BY category
      ORDER BY total DESC
    `;

      return await this.expenseEntity.query(query, [walletId, startDate, endDate]);
    } catch (error) {
      return [];
    }
  }

  async getMerchantSpending(walletId: string, dateRange: [string, string]) {
    try {
      const [startDate, endDate] = dateRange;

      const query = `
      SELECT 
        shop,
        COUNT(*) as visit_count,
        SUM(amount) as total_spent,
        AVG(amount) as avg_per_visit,
        MAX(date) as last_visit
      FROM expense
      WHERE walletId = ?
        AND date BETWEEN ? AND ?
        AND type = 'expense'
        AND schedule = 0
        AND shop IS NOT NULL 
        AND shop != ''
      GROUP BY shop
      ORDER BY total_spent DESC
      LIMIT 10
    `;

      return await this.expenseEntity.query(query, [walletId, startDate, endDate]);
    } catch (error) {
      return [];
    }
  }

  async getExpensesByLocation(walletId: string, locationId: string, dateRange: [string, string]) {
    try {
      const [startDate, endDate] = dateRange;

      const query = `
      SELECT 
        id,
        amount,
        description,
        date,
        type,
        category
      FROM expense
      WHERE walletId = ?
        AND locationId = ?
        AND date BETWEEN ? AND ?
        AND schedule = 0
      ORDER BY date DESC
    `;

      return await this.expenseEntity.query(query, [walletId, locationId, startDate, endDate]);
    } catch (error) {
      return [];
    }
  }

  async getExpensesWithSpontaneousRate(walletId: string, dateRange: [string, string]) {
    try {
      const [startDate, endDate] = dateRange;

      const query = `
        SELECT 
          id,
          amount,
          description,
          date,
          type,
          category,
          spontaneousRate
        FROM expense
        WHERE walletId = ?
          AND date BETWEEN ? AND ?
          AND schedule = 0
          AND spontaneousRate IS NOT NULL
        ORDER BY date DESC
      `;

      return await this.expenseEntity.query(query, [walletId, startDate, endDate]);
    } catch (error) {
      return [];
    }
  }

  async getDailyTotal(walletId: string, date: string): Promise<number> {
    try {
      const startDate = dayjs(date).startOf('day').format('YYYY-MM-DD HH:MM:ss');
      const endDate = dayjs(date).endOf('day').format('YYYY-MM-DD HH:MM:ss');

      const query = `
        SELECT 
          SUM(amount) as daily_total
        FROM expense
        WHERE walletId = ?
          AND date BETWEEN ? AND ?
          AND type = 'expense'
          AND schedule = 0
      `;

      const result = await this.expenseEntity.query(query, [walletId, startDate, endDate]);

      return result && result.length > 0 && result[0].daily_total ? parseFloat(result[0].daily_total) : 0;
    } catch (error) {
      console.error(`Error getting daily total for ${date}:`, error.message);
      return 0;
    }
  }

  async getRoundUp(userId: string, range: { from: string; to: string }) {
    const walletId = (await this.walletRepository.findOne({ where: { userId } })).id;

    return this.expenseEntity
      .createQueryBuilder('expense')
      .where('expense.walletId = :walletId', { walletId })
      .andWhere('expense.date BETWEEN :from AND :to', {
        from: dayjs(range.from).startOf('day').toDate(),
        to: dayjs(range.to).endOf('day').toDate(),
      })
      .getMany();
  }
}

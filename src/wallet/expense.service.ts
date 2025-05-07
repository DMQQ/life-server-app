import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExpenseEntity, ExpenseLocationEntity, ExpenseSubExpense, WalletEntity } from './wallet.entity';
import { Between, Like, Repository } from 'typeorm';
import * as moment from 'moment';

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
      SELECT category, SUM(amount) as total, AVG(amount) as avg, COUNT(amount) as count FROM expense WHERE walletId = ? AND date BETWEEN ? AND ? GROUP BY category
    `;

    const queryMonth = (month: string) => {
      const start = moment(month).startOf('month').format('YYYY-MM-DD');
      const end = moment(month).endOf('month').format('YYYY-MM-DD');
      return this.expenseEntity.query(query.trim(), [walletId, start, end]);
    };

    const monthsResponse = await Promise.all(months.map((m) => queryMonth(m)));

    return monthsResponse.map((arr, index) => ({
      month: moment.months()[moment(months[index]).get('month')],
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
        date: Between(moment(range.from).toDate(), moment(range.to).toDate()),
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
}

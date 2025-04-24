import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ExpenseEntity,
  ExpenseLocationEntity,
  ExpenseSubExpense,
  WalletEntity,
} from './wallet.entity';
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

  async createSubExpense(
    expenseId: string,
    subExpenseData: Partial<ExpenseSubExpense>,
  ) {
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

  async updateSubExpense(
    id: string,
    subExpenseData: Partial<ExpenseSubExpense>,
  ) {
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

  async addMultipleSubExpenses(
    expenseId: string,
    subExpenses: Partial<ExpenseSubExpense>[],
  ) {
    const subExpensesToSave = subExpenses.map((subExpense) =>
      this.subExpenseRepository.create({
        ...subExpense,
        expenseId,
      }),
    );

    return await this.subExpenseRepository.save(subExpensesToSave);
  }

  async monthlyCategoryComparison(userId: string, months: string[]) {
    const walletId = (
      await this.walletRepository.findOne({ where: { userId } })
    ).id;
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
    const walletId = (
      await this.walletRepository.findOne({ where: { userId } })
    ).id;

    const query = `
      SELECT DAY(date) AS day_of_month, SUM(amount) AS total_amount, COUNT(amount) as count, AVG(amount) as avg
      FROM expense
      WHERE walletId = ?
        AND date BETWEEN ? AND ?
      GROUP BY DAY(date)
      ORDER BY day_of_month
    `.trim();

    const response = await this.expenseEntity.query(query, [
      walletId,
      months[0],
      months[months.length - 1],
    ]);

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
}

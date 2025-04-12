import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ExpenseEntity,
  ExpenseLocationEntity,
  ExpenseSubExpense,
} from './wallet.entity';
import { Between, Like, Repository } from 'typeorm';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(ExpenseLocationEntity)
    private locationEntity: Repository<ExpenseLocationEntity>,

    @InjectRepository(ExpenseEntity)
    private expenseEntity: Repository<ExpenseEntity>,

    @InjectRepository(ExpenseSubExpense)
    private subExpenseRepository: Repository<ExpenseSubExpense>,
  ) {}

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
}

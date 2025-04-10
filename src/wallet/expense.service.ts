import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExpenseEntity, ExpenseLocationEntity } from './wallet.entity';
import { Between, Like, Repository } from 'typeorm';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(ExpenseLocationEntity)
    private locationEntity: Repository<ExpenseLocationEntity>,

    @InjectRepository(ExpenseEntity)
    private expenseEntity: Repository<ExpenseEntity>,
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
}

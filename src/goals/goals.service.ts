import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UserGoal, GoalCategory, GoalEntry } from './goals.entity';
import { startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class GoalService {
  constructor(
    @InjectRepository(UserGoal) private userGoalRepo: Repository<UserGoal>,
    @InjectRepository(GoalCategory)
    private categoryRepo: Repository<GoalCategory>,
    @InjectRepository(GoalEntry) private entryRepo: Repository<GoalEntry>,
  ) {}

  async getOrCreateUserGoal(userId: string): Promise<UserGoal> {
    let userGoal = await this.userGoalRepo.findOne({ where: { userId } });

    if (!userGoal) {
      userGoal = this.userGoalRepo.create({ userId });
      await this.userGoalRepo.save(userGoal);
    }

    return userGoal;
  }

  async createGoalCategory(
    userGoalId: string,
    input: {
      name: string;
      icon: string;
      description: string;
      min: number;
      max: number;
      target: number;
      unit: string;
    },
  ) {
    const exists = await this.categoryRepo.findOne({
      where: { userGoalId, name: input.name },
    });

    if (exists) {
      throw new ConflictException('Goal category already exists');
    }

    const category = this.categoryRepo.create({
      ...input,
      userGoalId,
    });

    return this.categoryRepo.save(category);
  }

  async upsertGoalEntry(
    categoryId: string,
    value: number,
    date: Date = new Date(),
  ) {
    const startDate = startOfDay(date);
    const endDate = endOfDay(date);

    // Find existing entry for the day
    let entry = await this.entryRepo.findOne({
      where: {
        categoryId,
        date: Between(startDate, endDate),
      },
    });

    if (entry) {
      // Update existing entry
      entry.value += value;
      return this.entryRepo.save(entry);
    }

    // Create new entry
    entry = this.entryRepo.create({
      categoryId,
      value,
      date: startDate,
    });

    return this.entryRepo.save(entry);
  }

  async getUserGoalWithEntries(
    userId: string,
    dateRange?: { start: Date; end: Date },
  ) {
    const userGoal = await this.userGoalRepo.findOne({
      where: {
        userId,
        ...(dateRange && {
          categories: {
            entries: {
              date: Between(dateRange.start, dateRange.end),
            },
          },
        }),
      },
      relations: ['categories', 'categories.entries'],
    });

    if (!userGoal) {
      throw new NotFoundException('User goal not found');
    }

    return userGoal;
  }

  async updateGoalCategory(
    id: string,
    input: Partial<Pick<GoalCategory, 'name' | 'icon' | 'description'>>,
  ) {
    const category = await this.categoryRepo.findOneBy({ id });

    if (!category) {
      throw new NotFoundException('Goal category not found');
    }

    Object.assign(category, input);
    return this.categoryRepo.save(category);
  }

  async deleteGoalCategory(id: string) {
    const category = await this.categoryRepo.findOneBy({ id });

    if (!category) {
      throw new NotFoundException('Goal category not found');
    }

    await this.entryRepo.delete({ categoryId: id });
    await this.categoryRepo.remove(category);
  }

  async getGoal(id: string) {
    return this.categoryRepo.findOne({
      where: { id },
      relations: ['entries'],
      order: {
        entries: { date: 'desc' },
      },
    });
  }
}

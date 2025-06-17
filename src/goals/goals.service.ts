import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { UserGoal, GoalCategory, GoalEntry } from './goals.entity';
import { startOfDay, endOfDay } from 'date-fns';
import dayjs from 'dayjs';

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

  async upsertGoalEntry(categoryId: string, value: number, date: Date = new Date()) {
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

  async getUserGoalWithEntries(userId: string, dateRange?: { start: Date; end: Date }) {
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

  async updateGoalCategory(id: string, input: Partial<Pick<GoalCategory, 'name' | 'icon' | 'description'>>) {
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

  async getGoalReminders(userId: string) {
    const userGoalId = (await this.getOrCreateUserGoal(userId)).id;

    const userCategories = await this.categoryRepo.find({
      where: { userGoalId },
      select: ['id', 'name', 'target'],
    });

    const today = dayjs().format('YYYY-MM-DD');

    const values = await Promise.all(
      userCategories.map(async (category) => {
        const entries = await this.entryRepo.find({
          where: {
            categoryId: category.id,
            date: Between(startOfDay(new Date(today)), endOfDay(new Date(today))),
          },
          select: ['value'],
        });

        const totalValue = entries.reduce((sum, entry) => sum + entry.value, 0);

        return {
          ...category,
          totalValue,
          remaining: category.target - totalValue,
        };
      }),
    );

    return values.map((category) => ({
      id: category.id,
      name: category.name,
      target: category.target,
      totalValue: category.totalValue,
      remaining: category.remaining,
      isCompleted: category.remaining <= 0,
    }));
  }

  async getUserCategories(userId: string) {
    const userGoal = await this.getOrCreateUserGoal(userId);

    return this.categoryRepo.find({
      where: { userGoalId: userGoal.id },
      select: ['id', 'name', 'icon', 'target', 'unit'],
    });
  }

  async getWeeklyStats(userId: string) {
    const userGoal = await this.getOrCreateUserGoal(userId);
    const categories = await this.categoryRepo.find({
      where: { userGoalId: userGoal.id },
      select: ['id', 'target'],
    });

    if (categories.length === 0) return null;

    const startDate = dayjs().subtract(6, 'day').startOf('day').toDate();
    const endDate = dayjs().endOf('day').toDate();

    let completedDays = 0;
    const totalDays = 7;

    for (let i = 0; i < 7; i++) {
      const checkDate = dayjs().subtract(i, 'day');
      const dayStart = startOfDay(checkDate.toDate());
      const dayEnd = endOfDay(checkDate.toDate());

      const dayCompleted = await Promise.all(
        categories.map(async (category) => {
          const entries = await this.entryRepo.find({
            where: {
              categoryId: category.id,
              date: Between(dayStart, dayEnd),
            },
            select: ['value'],
          });

          const totalValue = entries.reduce((sum, entry) => sum + entry.value, 0);
          return totalValue >= category.target;
        }),
      );

      if (dayCompleted.every((completed) => completed)) {
        completedDays++;
      }
    }

    return {
      completedDays,
      totalDays,
      percentage: Math.round((completedDays / totalDays) * 100),
    };
  }

  async getUserStreaks(userId: string) {
    const userGoal = await this.getOrCreateUserGoal(userId);
    const categories = await this.categoryRepo.find({
      where: { userGoalId: userGoal.id },
      select: ['id', 'name', 'target'],
    });

    const streaks = await Promise.all(
      categories.map(async (category) => {
        let currentStreak = 0;
        let completedToday = false;

        for (let i = 0; i < 30; i++) {
          const checkDate = dayjs().subtract(i, 'day');
          const dayStart = startOfDay(checkDate.toDate());
          const dayEnd = endOfDay(checkDate.toDate());

          const entries = await this.entryRepo.find({
            where: {
              categoryId: category.id,
              date: Between(dayStart, dayEnd),
            },
            select: ['value'],
          });

          const totalValue = entries.reduce((sum, entry) => sum + entry.value, 0);
          const goalMet = totalValue >= category.target;

          if (i === 0) {
            completedToday = goalMet;
          }

          if (goalMet) {
            currentStreak++;
          } else {
            break;
          }
        }

        return {
          categoryId: category.id,
          categoryName: category.name,
          days: currentStreak,
          completedToday,
        };
      }),
    );

    return streaks.filter((streak) => streak.days > 0);
  }

  async getLastActivityDate(userId: string) {
    const userGoal = await this.getOrCreateUserGoal(userId);
    const categories = await this.categoryRepo.find({
      where: { userGoalId: userGoal.id },
      select: ['id'],
    });

    if (categories.length === 0) return new Date();

    const categoryIds = categories.map((c) => c.id);

    const lastEntry = await this.entryRepo.findOne({
      where: {
        categoryId: In(categoryIds),
      },
      order: { date: 'DESC' },
      select: ['date'],
    });

    return lastEntry?.date || userGoal.createdAt;
  }

  async getGoalProgress(userId: string, categoryId?: string) {
    const userGoal = await this.getOrCreateUserGoal(userId);

    const whereCondition = categoryId ? { userGoalId: userGoal.id, id: categoryId } : { userGoalId: userGoal.id };

    const categories = await this.categoryRepo.find({
      where: whereCondition,
      select: ['id', 'name', 'target', 'unit'],
    });

    const today = dayjs();
    const startDate = startOfDay(today.toDate());
    const endDate = endOfDay(today.toDate());

    return Promise.all(
      categories.map(async (category) => {
        const entries = await this.entryRepo.find({
          where: {
            categoryId: category.id,
            date: Between(startDate, endDate),
          },
          select: ['value'],
        });

        const totalValue = entries.reduce((sum, entry) => sum + entry.value, 0);
        const progress = Math.min((totalValue / category.target) * 100, 100);

        return {
          ...category,
          currentValue: totalValue,
          progress: Math.round(progress),
          isCompleted: totalValue >= category.target,
          remaining: Math.max(category.target - totalValue, 0),
        };
      }),
    );
  }
}

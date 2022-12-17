import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReminderEntity } from 'src/entities/reminder.entity';
import { Repository } from 'typeorm';
import { CreateReminder } from './reminder.schemas';

@Injectable()
export class ReminderService {
  constructor(
    @InjectRepository(ReminderEntity)
    private readonly reminderRepository: Repository<ReminderEntity>,
  ) {}

  async getAllReminders(userId: string) {
    return this.reminderRepository.find({
      where: {
        userId,
      },
    });
  }

  async getReminderById(id: string) {
    return this.reminderRepository.findOne({
      where: {
        id,
      },
    });
  }

  async createReminder(props: CreateReminder & { userId: string }) {
    return this.reminderRepository.insert(props);
  }

  async updateReminder() {}

  async deleteReminder() {}

  async markAsDone() {}

  async markAsUndone() {}

  async getRemindersByDate() {}
}

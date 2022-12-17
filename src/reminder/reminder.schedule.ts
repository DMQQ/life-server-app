import { Injectable } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { ReminderService } from './reminder.service';

import moment from 'moment';

@Injectable()
export class ReminderSchedule {
  constructor(private reminderService: ReminderService) {}

  @Interval(1000 * 60)
  handleCron() {
    const date = new Date();
  }
}

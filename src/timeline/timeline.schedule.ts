import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { ExpoPushMessage } from 'expo-server-sdk';
import { TimelineScheduleService } from './timelineSchedule.service';
import * as dayjs from 'dayjs';

interface TodoResponse {
  id: string;
  title: string;
  isCompleted: boolean;
  userId: string;
}
import { BaseScheduler } from '../notifications/scheduler-base.service';
import { WalletService } from '../wallet/services/wallet.service';
import { ExpenseService } from '../wallet/services/expense.service';

@Injectable()
export class TimelineSchedule extends BaseScheduler {
  constructor(
    notificationService: NotificationsService,
    private timelineScheduleService: TimelineScheduleService,
    private walletService: WalletService,
    private expenseService: ExpenseService,
  ) {
    super(notificationService);
  }

  @Cron('0 * * * * *', { timeZone: 'Europe/Warsaw' })
  async handleCron() {
    const events = await this.timelineScheduleService.findEventsByTypeWithCurrentTime('beginTime');

    console.log(`Found ${events.length} events starting now.`);

    for (const event of events) {
      const todos = await this.timelineScheduleService.getUncompletedTodosForUser(event.id);

      const eventWithTodos = {
        ...event,
        todos: todos.map((todo: TodoResponse) => ({
          id: todo.id,
          title: todo.title,
          isCompleted: todo.isCompleted,
        })),
      };

      const userToken = await this.notificationService.findUserToken(event.userId);

      if (userToken?.liveActivityToken) {
        try {
          await this.notificationService.sendTimelineLiveActivity(event.userId, eventWithTodos);
          console.log(`Live Activity notification sent for event ${event.id}`);
        } catch (error) {
          console.error(`Failed to send Live Activity for event ${event.id}:`, error);
        }
      } else {
        console.log(`No live activity token for user ${event.userId}, skipping notification`);
      }
    }
  }

  @Cron('0 * * * * *', { timeZone: 'Europe/Warsaw' })
  async handleEndingEvents() {
    const events = await this.timelineScheduleService.findEventsByTypeWithCurrentTime('endTime');

    for (const event of events) {
      // Check if user has live activity token
      const userToken = await this.notificationService.findUserToken(event.userId);

      if (userToken?.liveActivityToken) {
        // Send Live Activity end notification
        try {
          // Create a copy of event with ending state
          await this.notificationService.sendTimelineEndActivity(event.userId, event);
          console.log(`Live Activity end notification sent for event ${event.id}`);
        } catch (error) {
          console.error(`Failed to send Live Activity end for event ${event.id}:`, error);
        }
      } else {
        console.log(`No live activity token for user ${event.userId}, skipping end notification`);
      }
    }
  }
}

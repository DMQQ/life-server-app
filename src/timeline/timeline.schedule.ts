import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { ExpoPushMessage } from 'expo-server-sdk';
import { TimelineScheduleService } from './timelineSchedule.service';
interface TodoResponse {
  id: string;
  title: string;
  isCompleted: boolean;
  userId: string;
}
import { BaseScheduler } from '../notifications/scheduler-base.service';
import { WalletService } from '../wallet/services/wallet.service';
import { ExpenseService } from '../wallet/services/expense.service';
import dayjs from 'dayjs';

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

    const notificationsToSend = [];

    for (const event of events) {
      const todos = await this.timelineScheduleService.getUncompletedTodosForUser(event.userId);

      let description = event.description;
      if (todos.length > 0) {
        const todosText = todos.map((todo) => `• ${todo.title}`).join('\n');
        description = `${event.description}\n\nTodos:\n${todosText}`;
      }

      const notification: ExpoPushMessage = {
        badge: 1,
        to: event.token,
        subtitle: 'Daily reminder',
        sound: 'default',
        title: event.title,
        body: description,
        data: {
          data: 'Your scheduled event is now running!',
          eventId: event.id,
          type: 'timeline',
        },
      };

      notificationsToSend.push({
        notification,
        userId: event.userId,
      });
    }

    // Send notifications and save to history
    for (const { notification, userId } of notificationsToSend) {
      await this.sendSingleNotification(notification, userId);
    }
  }

  @Cron('0 * * * * *', { timeZone: 'Europe/Warsaw' })
  async handleEndingEvents() {
    const events = await this.timelineScheduleService.findEventsByTypeWithCurrentTime('endTime');

    const notificationsToSend = [];

    for (const event of events) {
      const notification: ExpoPushMessage = {
        badge: 1,
        to: event.token,
        subtitle: 'Event ending',
        sound: 'default',
        title: `${event.title.substring(0, 40)} ending`,
        body: `Time to wrap up: ${event.description.substring(0, 40)}`,
        data: {
          data: 'Your scheduled event is ending!',
          eventId: event.id,
        },
      };

      notificationsToSend.push({
        notification,
        userId: event.userId,
      });
    }

    for (const { notification, userId } of notificationsToSend) {
      await this.sendSingleNotification(notification, userId);
    }
  }
}

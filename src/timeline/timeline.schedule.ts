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
import { LiveActivityService } from './live-activity.service';
import { LiveActivityStatus } from './live-activity.entity';

@Injectable()
export class TimelineSchedule extends BaseScheduler {
  constructor(
    notificationService: NotificationsService,
    private timelineScheduleService: TimelineScheduleService,
    private walletService: WalletService,
    private expenseService: ExpenseService,
    private liveActivityService: LiveActivityService,
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
          //@ts-ignore raw z sqla 0/1 a swift oczekuje true/false
          isCompleted: todo.isCompleted === 0 ? false : true,
        })),
      };

      const userToken = await this.notificationService.findUserToken(event.userId);

      if (userToken?.liveActivityToken) {
        try {
          await this.notificationService.sendTimelineLiveActivity(event.userId, eventWithTodos);
          console.log(`Live Activity notification sent for event ${event.id}`);

          // Create LiveActivity database entry
          const currentDate = dayjs().format('YYYY-MM-DD');
          const beginTime = this.parseTimeToTimestamp(currentDate, event.beginTime);
          const endTime = this.parseTimeToTimestamp(currentDate, event.endTime);
          
          await this.liveActivityService.createActivity({
            timelineId: event.id,
            beginTime,
            endTime,
            status: LiveActivityStatus.SENT,
          });
          
          console.log(`LiveActivity database entry created for event ${event.id}`);
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

          // Update LiveActivity database entry to END status
          const existingActivity = await this.liveActivityService.findActivityByTimelineId(event.id);
          if (existingActivity) {
            await this.liveActivityService.updateActivity(existingActivity.id, {
              status: LiveActivityStatus.END,
            });
            console.log(`LiveActivity database entry updated to END for event ${event.id}`);
          }
        } catch (error) {
          console.error(`Failed to send Live Activity end for event ${event.id}:`, error);
        }
      } else {
        console.log(`No live activity token for user ${event.userId}, skipping end notification`);
      }
    }
  }

  private parseTimeToTimestamp(date: string, time: string): number {
    // Combine date and time into a dayjs object and return timestamp in milliseconds
    const dateTime = dayjs(`${date} ${time}`);
    return dateTime.valueOf();
  }
}

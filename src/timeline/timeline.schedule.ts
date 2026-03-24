import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { TimelineScheduleService } from './timelineSchedule.service';
import * as dayjs from 'dayjs';
import { BaseScheduler } from '../notifications/scheduler-base.service';
import { WalletService } from '../wallet/services/wallet.service';
import { ExpenseService } from '../wallet/services/expense.service';
import { LiveActivityService } from './live-activity.service';
import { LiveActivityStatus } from './live-activity.entity';

interface TodoResponse {
  id: string;
  title: string;
  isCompleted: boolean;
  userId: string;
}

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
          //@ts-ignore raw sql returns 0/1 while swift expects true/false
          isCompleted: todo.isCompleted === 0 ? false : true,
        })),
      };

      const userToken = await this.notificationService.findUserToken(event.userId);

      if (userToken?.liveActivityToken) {
        try {
          await this.notificationService.sendTimelineLiveActivity(event.userId, eventWithTodos);
          console.log(`Live Activity notification sent for occurrence ${event.id}`);

          const currentDate = dayjs().format('YYYY-MM-DD');
          const beginTime = this.parseTimeToTimestamp(currentDate, event.beginTime);
          const endTime = this.parseTimeToTimestamp(currentDate, event.endTime);

          await this.liveActivityService.createActivity({
            occurrenceId: event.id,
            beginTime,
            endTime,
            status: LiveActivityStatus.SENT,
          });

          console.log(`LiveActivity database entry created for occurrence ${event.id}`);
        } catch (error) {
          console.error(`Failed to send Live Activity for occurrence ${event.id}:`, error);
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
      const userToken = await this.notificationService.findUserToken(event.userId);

      if (userToken?.liveActivityToken) {
        try {
          await this.notificationService.sendTimelineEndActivity(event.userId, event);
          console.log(`Live Activity end notification sent for occurrence ${event.id}`);

          const existingActivity = await this.liveActivityService.findActivityByOccurrenceId(event.id);
          if (existingActivity) {
            await this.liveActivityService.updateActivity(existingActivity.id, {
              status: LiveActivityStatus.END,
            });
            console.log(`LiveActivity database entry updated to END for occurrence ${event.id}`);
          }
        } catch (error) {
          console.error(`Failed to send Live Activity end for occurrence ${event.id}:`, error);
        }
      } else {
        console.log(`No live activity token for user ${event.userId}, skipping end notification`);
      }
    }
  }

  private parseTimeToTimestamp(date: string, time: string): number {
    return dayjs(`${date} ${time}`).valueOf();
  }
}

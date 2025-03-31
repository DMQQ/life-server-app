import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { ExpoPushMessage } from 'expo-server-sdk';
import { TimelineScheduleService } from './timelineSchedule.service';

@Injectable()
export class TimelineSchedule {
  constructor(
    private notifiService: NotificationsService,
    private timelineScheduleService: TimelineScheduleService,
  ) {}

  @Cron('0 * * * * *', { timeZone: 'Europe/Warsaw' })
  async handleCron() {
    const events =
      await this.timelineScheduleService.findEventsByTypeWithCurrentTime(
        'beginTime',
      );

    const messages = [] as ExpoPushMessage[];

    for (const event of events) {
      messages.push({
        badge: 1,
        to: event.token,
        subtitle: 'Daily reminder',
        sound: 'default',
        title: event.title.substring(0, 50),
        body: event.description.substring(0, 50),
        data: {
          data: 'Your schedulded event is now running!',
          eventId: event.id,
        },
      });
    }

    await this.notifiService.sendChunkNotifications(messages);
  }

  @Cron('0 * * * * *', { timeZone: 'Europe/Warsaw' })
  async handleEndingEvents() {
    const events =
      await this.timelineScheduleService.findEventsByTypeWithCurrentTime(
        'endTime',
      );

    const messages = [] as ExpoPushMessage[];

    for (const event of events) {
      messages.push({
        badge: 1,
        to: event.token,
        subtitle: 'Daily reminder',
        sound: 'default',
        title: event.title.substring(0, 50),
        body: event.description.substring(0, 50),
        data: {
          data: 'Your schedulded event is now running!',
          eventId: event.id,
        },
      });
    }

    await this.notifiService.sendChunkNotifications(messages);
  }
}

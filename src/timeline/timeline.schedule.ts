import { Injectable } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { TimelineService } from './timeline.service';
import * as moment from 'moment';
import { NotificationsService } from 'src/notifications/notifications.service';
import { ExpoPushToken, ExpoPushMessage } from 'expo-server-sdk';
import { TimelineScheduleService } from './timelineSchedule.service';

@Injectable()
export class TimelineSchedule {
  constructor(
    private notifiService: NotificationsService,
    private timelineScheduleService: TimelineScheduleService,
  ) {}
  @Cron('0 * * * * *', { timeZone: 'Europe/Warsaw' })
  async handleCron() {
    const date = moment().format('YYYY-MM-DD');

    const time = moment().format('HH:mm:ss');

    const events = await this.timelineScheduleService.findEventsWithDateAndTime(
      date,
      time,
    );

    const messages = [] as ExpoPushMessage[];

    for (const event of events) {
      const user = await this.notifiService.findUserToken(event.userId);

      if (user) {
        messages.push({
          badge: 1,
          to: user.token,
          subtitle: 'Daily reminder',
          sound: 'default',
          title: event.title,
          body: event.description,
          data: { data: "Hello it's your daily reminder" },
        });
      }
    }

    const output = await this.notifiService.sendChunkNotifications(messages);
  }

  @Cron('0 * * * * *', { timeZone: 'Europe/Warsaw' })
  async handleEndingEvents() {
    const currentDate = moment().format('YYYY-MM-DD');

    const currentTime = [...moment().format('HH:mm').split(':'), '00'].join(
      ':',
    );

    const events = await this.timelineScheduleService.findEndingEvents(
      currentDate,
      currentTime,
    );

    const messages = [] as ExpoPushMessage[];

    for (const event of events) {
      const user = await this.notifiService.findUserToken(event.userId);

      if (user) {
        messages.push({
          badge: 1,
          to: user.token,
          subtitle: 'Your event is ending',
          sound: 'default',
          title: event.title + 'ends at' + event.endTime,
          body: event.description,
          data: { data: "Hello it's your daily reminder" },
        });
      }
    }

    await this.notifiService.sendChunkNotifications(messages);
  }
}

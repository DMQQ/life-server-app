import { Injectable, Logger } from '@nestjs/common';
import { ExpoPushMessage } from 'expo-server-sdk';
import { NotificationsEntity } from 'src/notifications/notifications.entity';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class BaseScheduler {
  public readonly logger = new Logger(BaseScheduler.name);

  constructor(protected notificationService: NotificationsService) {}
  public async sendSingleNotification(notification: ExpoPushMessage, userId?: string) {
    try {
      if (!notification || !notification.to) {
        return;
      }

      await this.notificationService.sendChunkNotifications([notification]);

      if (userId) {
        await this.notificationService.saveNotification(userId, notification);
      }

      this.logger.log(`Successfully sent notification to ${notification.to.toString().substring(0, 10)}...`);
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
    }
  }

  public truncateNotification(body: string): string {
    return body;
  }

  public isNotificationEnabled(userNotification: NotificationsEntity, notificationType: string): boolean {
    if (!userNotification || !userNotification.isEnable) {
      return false;
    }

    if (!userNotification.enabledNotifications || typeof userNotification.enabledNotifications !== 'object') {
      return true;
    }

    return userNotification.enabledNotifications[notificationType] !== false;
  }

  public async forEachNotification(
    tag: string,

    callback: (user: NotificationsEntity) => Promise<ExpoPushMessage | null | undefined>,
  ) {
    try {
      const users = await this.notificationService.findAll();

      const notificationsQueue = {} as Record<string, ExpoPushMessage>;

      for (const user of users) {
        if (!this.isNotificationEnabled(user, tag)) continue;
        try {
          const result = await callback(user);

          if (result) notificationsQueue[user.userId] = result;
        } catch (error) {
          this.logger.error('forEachNotification failed for user: ' + JSON.stringify(user), error);
        }
      }

      await Promise.allSettled([
        this.notificationService.sendChunkNotifications(Object.values(notificationsQueue)),
        this.notificationService.saveBulkNotifications(
          Object.entries(notificationsQueue).map(([userId, value]) => ({
            ...value,
            userId,
          })),
        ),
      ]);
    } catch (error) {
      this.logger.fatal('forEachNotification failed this.notificationService.findAll()', error);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ExpoPushMessage } from 'expo-server-sdk';
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
}

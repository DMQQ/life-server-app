import { Injectable, Logger } from '@nestjs/common';
import { ExpoPushMessage } from 'expo-server-sdk';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class BaseScheduler {
  public readonly logger = new Logger(BaseScheduler.name);

  constructor(protected notificationService: NotificationsService) {}
  public async sendSingleNotification(notification: ExpoPushMessage) {
    try {
      if (!notification || !notification.to) {
        return;
      }

      await this.notificationService.sendChunkNotifications([notification]);
      this.logger.log(`Successfully sent notification to ${notification.to.toString().substring(0, 10)}...`);
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
    }
  }

  public truncateNotification(body: string): string {
    const MAX_LENGTH = 178;
    return body.length > MAX_LENGTH ? body.substring(0, MAX_LENGTH - 3) + '...' : body;
  }
}

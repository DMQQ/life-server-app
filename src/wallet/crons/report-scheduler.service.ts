import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WalletService } from '../wallet.service';
import { ExpoPushMessage } from 'expo-server-sdk';
import * as moment from 'moment';

@Injectable()
export class ReportSchedulerService {
  private readonly logger = new Logger(ReportSchedulerService.name);

  constructor(private notificationService: NotificationsService, private walletService: WalletService) {}

  @Cron('0 14 * * 0', {
    timeZone: 'Europe/Warsaw',
  })
  async weeklyReport() {
    const users = await this.notificationService.findAll();

    const range = [
      moment().isoWeekday(1).startOf('day').format('YYYY-MM-DD'),
      moment().isoWeekday(7).endOf('day').format('YYYY-MM-DD'),
    ] as [string, string];

    const notifications = [] as ExpoPushMessage[];

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const statsResult = await this.walletService.getStatistics(user.userId, range);

        if (!statsResult || !statsResult.length) continue;
        const stats = statsResult[0];

        notifications.push({
          to: user.token,
          sound: 'default',
          title: '📊 Weekly Spendings Report',
          body: [
            `💰 You have spent ${stats.total.toFixed(2)} this week, ${stats.income.toFixed(
              2,
            )} of which was income ⬆️ and ${stats.expense.toFixed(2)} was expense ⬇️.`,
            `💵 You have ${stats.lastBalance.toFixed(2)} left in your wallet.`,
            `🔼 You spent at most ${stats.max.toFixed(2)} and at least ${stats.min.toFixed(
              2,
            )} in a single transaction 🔽.`,
            `📈 Your average transaction was ${stats.average.toFixed(2)} with a total of ${stats.count} transactions.`,
          ].join('\n'),
        });
        await this.notificationService.saveNotification(user.userId, notifications[notifications.length - 1]);
      } catch (error) {
        this.logger.error(`Error processing weekly report for user ${user.userId}: ${error.message}`);
      }
    }

    if (notifications.length > 0) {
      try {
        const response = await this.notificationService.sendChunkNotifications(notifications);
        this.logger.log(`Weekly report notifications sent: ${response}`);
      } catch (error) {
        this.logger.error(`Error sending weekly report notifications: ${error.message}`);
      }
    }
  }

  @Cron('0 14 28-31 * *', {
    timeZone: 'Europe/Warsaw',
  })
  async monthlyReport() {
    if (!moment().isSame(moment().endOf('month'), 'day')) {
      return;
    }

    const users = await this.notificationService.findAll();

    const range = [moment().startOf('month').format('YYYY-MM-DD'), moment().endOf('month').format('YYYY-MM-DD')] as [
      string,
      string,
    ];

    const notifications = [] as ExpoPushMessage[];

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const statsResult = await this.walletService.getStatistics(user.userId, range);

        if (!statsResult || !statsResult.length) continue;
        const stats = statsResult[0];

        notifications.push({
          to: user.token,
          sound: 'default',
          title: '📆 Monthly Spendings Report',
          body: [
            `💰 You have spent ${stats.total.toFixed(2)} this month, ${stats.income.toFixed(
              2,
            )} of which was income ⬆️ and ${stats.expense.toFixed(2)} was expense ⬇️.`,
            `💵 You have ${stats.lastBalance.toFixed(2)} left in your wallet.`,
            `🔼 You spent at most ${stats.max.toFixed(2)} and at least ${stats.min.toFixed(
              2,
            )} in a single transaction 🔽.`,
            `📈 Your average transaction was ${stats.average.toFixed(2)} with a total of ${stats.count} transactions.`,
          ].join('\n'),
        });
        await this.notificationService.saveNotification(user.userId, notifications[notifications.length - 1]);
      } catch (error) {
        this.logger.error(`Error processing monthly report for user ${user.userId}: ${error.message}`);
      }
    }

    if (notifications.length > 0) {
      try {
        await this.notificationService.sendChunkNotifications(notifications);
      } catch (error) {
        this.logger.error(`Error sending monthly report notifications: ${error.message}`);
      }
    }
  }
}

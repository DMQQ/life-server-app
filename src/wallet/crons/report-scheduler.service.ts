import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WalletService } from '../services/wallet.service';
import { ExpoPushMessage } from 'expo-server-sdk';
import { BaseScheduler } from '../../notifications/scheduler-base.service';
import * as dayjs from 'dayjs';

@Injectable()
export class ReportSchedulerService extends BaseScheduler {
  constructor(
    notificationService: NotificationsService,
    private walletService: WalletService,
  ) {
    super(notificationService);
  }

  @Cron('0 14 * * 0', {
    timeZone: 'Europe/Warsaw',
  })
  async weeklyReport() {
    const range = [
      dayjs().isoWeekday(1).startOf('day').format('YYYY-MM-DD'),
      dayjs().isoWeekday(7).endOf('day').format('YYYY-MM-DD'),
    ] as [string, string];

    this.forEachNotification('weeklyReport', async (user) => {
      try {
        if (!user.token) return null;

        const stats = await this.walletService.getStatistics(user.userId, range);

        if (!stats) return null;

        return {
          to: user.token,
          sound: 'default',
          title: '📊 Weekly Spendings Report',
          body: [
            `💰 You have spent ${stats.expense.toFixed(2)}zł this week, and earned ${stats.income.toFixed(2)}zł`,
            `💵 You have ${stats.lastBalance.toFixed(2)} left in your wallet.`,
            `🔼 You spent at most ${stats.max.toFixed(2)} and at least ${stats.min.toFixed(
              2,
            )} in a single transaction 🔽.`,
            `📈 Your average was ${stats.average.toFixed(2)} with a total of ${stats.count} transactions.`,
          ].join('\n'),
        } as ExpoPushMessage;
      } catch (error) {
        this.logger.error(`Error processing weekly report for user ${user.userId}: ${error.message}`);
        return null;
      }
    });
  }

  @Cron('0 14 28-31 * *', {
    timeZone: 'Europe/Warsaw',
  })
  async monthlyReport() {
    if (!dayjs().isSame(dayjs().endOf('month'), 'day')) {
      return;
    }

    const range = [dayjs().startOf('month').format('YYYY-MM-DD'), dayjs().endOf('month').format('YYYY-MM-DD')] as [
      string,
      string,
    ];

    this.forEachNotification('monthlyReport', async (user) => {
      try {
        if (!user.token) return null;

        const stats = await this.walletService.getStatistics(user.userId, range);

        if (!stats) return null;

        return {
          to: user.token,
          sound: 'default',
          title: '📆 Monthly Spendings Report',
          body: `Hi, You spent ${stats.expense.toFixed(2)}zł this month, on average ${stats.average}zł on ${stats.count} entries, least/most (${stats.min.toFixed(2)}, ${stats.max.toFixed(2)})zł, you earned ${stats.income.toFixed(2)}zł`,
        } as ExpoPushMessage;
      } catch (error) {
        this.logger.error(`Error processing monthly report for user ${user.userId}: ${error.message}`);
        return null;
      }
    });
  }
}

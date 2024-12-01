import { Injectable } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WalletService } from './wallet.service';
import { ExpoPushMessage } from 'expo-server-sdk';

import * as moment from 'moment';

@Injectable()
export class WalletSchedule {
  constructor(
    private notificationService: NotificationsService,
    private walletService: WalletService,
  ) {}

  @Cron('0 14 * * 0', {
    timeZone: 'Europe/Warsaw',
  })
  async weeklyReport() {
    const users = await this.notificationService.findAll();

    const range = [
      moment().startOf('week').format('YYYY-MM-DD'),
      moment().endOf('week').format('YYYY-MM-DD'),
    ] as [string, string];

    const notifications = [] as ExpoPushMessage[];

    for (const user of users) {
      if (!user.token || user.isEnable === false) continue;

      const [stats] = await this.walletService.getStatistics(user.id, range);

      if (!stats) continue;

      notifications.push({
        to: user.token,
        sound: 'default',
        title: 'Weekly spendings report',
        body: [
          `You have spent ${stats.total} this week, ${stats.income} of which was income and ${stats.expense} was expense.`,
          `You have ${stats.lastBalance} left in your wallet.`,
          `You spent at most ${stats.max} and at least ${stats.min} in a single transaction.`,
          `Your average transaction was ${stats.average} with a total of ${stats.count} transactions.`,
        ].join('\n'),
      });
    }

    await this.notificationService.sendChunkNotifications(notifications);
  }

  @Cron('0 14 28-31 * *', {
    timeZone: 'Europe/Warsaw',
  })
  async monthlyReport() {
    // Check if today is the last day of the month
    if (!moment().isSame(moment().endOf('month'), 'day')) {
      return;
    }

    const users = await this.notificationService.findAll();

    const range = [
      moment().startOf('month').format('YYYY-MM-DD'),
      moment().endOf('month').format('YYYY-MM-DD'),
    ] as [string, string];

    const notifications = [] as ExpoPushMessage[];

    for (const user of users) {
      if (!user.token || user.isEnable === false) continue;

      const [stats] = await this.walletService.getStatistics(user.id, range);

      if (!stats) continue;

      notifications.push({
        to: user.token,
        sound: 'default',
        title: 'Monthly spendings report',
        body: [
          `You have spent ${stats.total} this month, ${stats.income} of which was income and ${stats.expense} was expense.`,
          `You have ${stats.lastBalance} left in your wallet.`,
          `You spent at most ${stats.max} and at least ${stats.min} in a single transaction.`,
          `Your average transaction was ${stats.average} with a total of ${stats.count} transactions.`,
        ].join('\n'),
      });
    }

    await this.notificationService.sendChunkNotifications(notifications);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async addScheduledTransactions() {
    const transactions = await this.walletService.getScheduledTransactions(
      new Date(),
    );

    console.log(
      'Adding scheduled transactions',
      new Date(),
      transactions.map((t) => t.date),
    );

    const promises = transactions.map((transaction) =>
      this.walletService.addScheduledTransaction(transaction),
    );

    const results = await Promise.allSettled(promises);

    console.log(
      'Scheduled transactions added',
      results.map((r) => r.status),
    );
  }
}

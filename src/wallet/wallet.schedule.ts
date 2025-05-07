import { Injectable } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WalletService } from './wallet.service';
import { ExpoPushMessage } from 'expo-server-sdk';

import * as moment from 'moment';
import { SubscriptionService } from './subscriptions.service';
import { LimitsService } from './limits.service';
import { ExpenseType, LimitRange } from './wallet.entity';
import { ExpenseService } from './expense.service';

@Injectable()
export class WalletSchedule {
  constructor(
    private notificationService: NotificationsService,
    private walletService: WalletService,
    private subscriptionService: SubscriptionService,

    private limitsService: LimitsService,

    private expenseService: ExpenseService,
  ) {}

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
      if (!user.token || user.isEnable === false) continue;

      const [stats] = await this.walletService.getStatistics(
        user.userId,
        range,
      );

      if (!stats) continue;

      notifications.push({
        to: user.token,
        sound: 'default',
        title: '📊 Weekly Spendings Report',
        body: [
          `💰 You have spent ${stats.total} this week, ${stats.income} of which was income ⬆️ and ${stats.expense} was expense ⬇️.`,
          `💵 You have ${stats.lastBalance} left in your wallet.`,
          `🔼 You spent at most ${stats.max} and at least ${stats.min} in a single transaction 🔽.`,
          `📈 Your average transaction was ${stats.average} with a total of ${stats.count} transactions.`,
        ].join('\n'),
      });
    }

    const response = await this.notificationService.sendChunkNotifications(
      notifications,
    );

    console.log(response);
  }

  @Cron('0 14 28-31 * *', {
    timeZone: 'Europe/Warsaw',
  })
  async monthlyReport() {
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

      const [stats] = await this.walletService.getStatistics(
        user.userId,
        range,
      );

      if (!stats) continue;

      notifications.push({
        to: user.token,
        sound: 'default',
        title: '📆 Monthly Spendings Report',
        body: [
          `💰 You have spent ${stats.total} this month, ${stats.income} of which was income ⬆️ and ${stats.expense} was expense ⬇️.`,
          `💵 You have ${stats.lastBalance} left in your wallet.`,
          `🔼 You spent at most ${stats.max} and at least ${stats.min} in a single transaction 🔽.`,
          `📈 Your average transaction was ${stats.average} with a total of ${stats.count} transactions.`,
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

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async insertSubscriptions() {
    const subscriptions =
      await this.subscriptionService.getTodaySubscriptions();

    for (const subscription of subscriptions) {
      if (!subscription.isActive) continue;

      (async () => {
        const walletId = subscription.walletId;
        const expense = await this.walletService.getSubscriptionLastExpense(
          subscription.id,
        );

        if (!expense) {
          console.log('No expense found for subscription', subscription.id);
          return;
        }

        delete expense.id;

        await this.walletService.createSubscriptionExpense(walletId, {
          ...expense,
          date: new Date(),
          subscriptionId: subscription.id,
          description:
            expense.description +
            ' ' +
            this.subscriptionService.getBillingCycleString(
              subscription.nextBillingDate,
              subscription.billingCycle,
            ),
        });

        await this.subscriptionService.setNextBillingDate(subscription);
      })();
    }
  }
  @Cron('0 20 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async dailyInsights() {
    const users = await this.notificationService.findAll();
    const notifications = [] as ExpoPushMessage[];

    for (const user of users) {
      if (!user.token || user.isEnable === false) continue;

      const today = moment().format('YYYY-MM-DD');
      const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');

      // Get today's transactions
      const todayRange = [today, today] as [string, string];
      const [todayStats] = await this.walletService.getStatistics(
        user.userId,
        todayRange,
      );

      // No stats available for this user
      if (!todayStats) continue;

      // Get yesterday's transactions for comparison
      const yesterdayRange = [yesterday, yesterday] as [string, string];
      const [yesterdayStats] = await this.walletService.getStatistics(
        user.userId,
        yesterdayRange,
      );

      let messageBody = '';

      // Alternate between different types of daily insights
      const day = moment().day();

      if (todayStats.count === 0) {
        // No spending today insight
        messageBody = `📉 No spending recorded today! You're ${
          yesterdayStats
            ? `$${yesterdayStats.average.toFixed(2)} under your daily average`
            : 'saving money'
        }. Keep it up! 💪`;
      } else if (day % 3 === 0) {
        // Today's spending summary
        messageBody = `💰 Today's Spending: $${todayStats.expense} on ${
          todayStats.count
        } transactions. Balance: $${todayStats.lastBalance}. ${
          todayStats.theMostCommonCategory
            ? `Top category: ${todayStats.theMostCommonCategory} 🔝`
            : ''
        }`;
      } else if (day % 3 === 1) {
        // Spending pace
        const weekStartDate = moment().startOf('week').format('YYYY-MM-DD');
        const weekRange = [weekStartDate, today] as [string, string];
        const [weekStats] = await this.walletService.getStatistics(
          user.userId,
          weekRange,
        );

        if (weekStats) {
          const daysPassed = moment().diff(moment(weekStartDate), 'days') + 1;
          const dailyAverage = weekStats.expense / daysPassed;
          const projectedWeekTotal = dailyAverage * 7;

          messageBody = `📊 Your spending pace this week: $${dailyAverage.toFixed(
            2,
          )}/day. At this rate, you'll spend $${projectedWeekTotal.toFixed(
            2,
          )} by weekend.`;
        }
      } else {
        // Comparison with yesterday
        if (yesterdayStats && yesterdayStats.expense > 0) {
          const percentChange =
            ((todayStats.expense - yesterdayStats.expense) /
              yesterdayStats.expense) *
            100;
          const isMore = percentChange > 0;

          messageBody = `📆 Spent $${
            todayStats.expense
          } today, which is ${Math.abs(percentChange).toFixed(0)}% ${
            isMore ? 'more 📈' : 'less 📉'
          } than yesterday. Current balance: $${todayStats.lastBalance}.`;
        }
      }

      // If we have a message, add it to notifications
      if (messageBody) {
        notifications.push({
          to: user.token,
          sound: 'default',
          title: 'Daily Finance Update',
          body: messageBody,
        });
      }
    }

    if (notifications.length > 0) {
      await this.notificationService.sendChunkNotifications(notifications);
    }
  }

  // Budget Alerts at 10 AM
  @Cron('0 10 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async budgetAlerts() {
    const users = await this.notificationService.findAll();
    const notifications = [] as ExpoPushMessage[];

    for (const user of users) {
      if (!user.token || user.isEnable === false) continue;

      const wallet = await this.walletService.findWalletId(user.userId);
      if (!wallet) continue;

      // Get all monthly limits
      const monthlyLimits = (await this.limitsService.limits(
        wallet.id,
        LimitRange.monthly,
      )) as any;

      // Check for limits approaching threshold
      const daysLeftInMonth = moment().endOf('month').diff(moment(), 'days');

      for (const limit of monthlyLimits) {
        const percentUsed = (limit.current / limit.amount) * 100;

        // Alert when usage is 85% or more
        if (percentUsed >= 85 && percentUsed < 100) {
          const remaining = limit.amount - limit.current;

          notifications.push({
            to: user.token,
            sound: 'default',
            title: '⚠️ Budget Alert',
            body: `💸 ${limit.category} at ${percentUsed.toFixed(
              0,
            )}% of monthly limit. $${remaining.toFixed(
              2,
            )} remaining for the next ${daysLeftInMonth} days.`,
          });
          break; // Only send one limit alert per day
        }
      }

      if (wallet.balance < 100) {
        const lastMonth = moment().subtract(1, 'month').format('YYYY-MM-DD');
        const today = moment().format('YYYY-MM-DD');
        const monthRange = { from: lastMonth, to: today };

        const recentExpenses = await this.expenseService.getExpenses(
          user.userId,
          monthRange,
        );
        const incomes = recentExpenses.filter(
          (exp) => exp.type === ExpenseType.income,
        );

        let daysToIncome = 7; // Default assumption
        if (incomes.length > 0) {
          // Sort by date, most recent first
          incomes.sort(
            (a, b) => moment(b.date).valueOf() - moment(a.date).valueOf(),
          );
          const lastIncomeDate = moment(incomes[0].date);

          // If we have a regular monthly pattern, predict next income
          if (incomes.length >= 2) {
            const secondLastIncomeDate = moment(incomes[1].date);
            const daysBetweenIncomes = lastIncomeDate.diff(
              secondLastIncomeDate,
              'days',
            );
            if (daysBetweenIncomes > 20 && daysBetweenIncomes < 35) {
              // Likely monthly income
              const nextPredictedIncome = lastIncomeDate
                .clone()
                .add(daysBetweenIncomes, 'days');
              daysToIncome = nextPredictedIncome.diff(moment(), 'days');
            }
          }
        }

        notifications.push({
          to: user.token,
          sound: 'default',
          title: '⚠️ Low Balance Warning',
          body: `💰 $${wallet.balance.toFixed(
            2,
          )} remaining. ${daysToIncome} days until next predicted income. Plan your expenses carefully!`,
        });
      }
    }

    if (notifications.length > 0) {
      await this.notificationService.sendChunkNotifications(notifications);
    }
  }

  // Subscription Reminders at 9 AM
  @Cron('0 9 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async subscriptionReminders() {
    const users = await this.notificationService.findAll();
    const notifications = [] as ExpoPushMessage[];

    for (const user of users) {
      if (!user.token || user.isEnable === false) continue;

      const wallet = await this.walletService.findWalletId(user.userId);
      if (!wallet) continue;

      // Get all active subscriptions
      const now = new Date();
      const threeDaysLater = moment().add(3, 'days').toDate();

      // Get all subscriptions with upcoming billing in the next 3 days
      const upcomingSubscriptions = await this.subscriptionService
        .getAllSubscriptions()
        .then((subs) =>
          subs.filter(
            (sub) =>
              sub.walletId === wallet.id &&
              sub.isActive &&
              sub.nextBillingDate >= now &&
              sub.nextBillingDate <= threeDaysLater,
          ),
        );

      for (const subscription of upcomingSubscriptions) {
        const daysUntilCharge = moment(subscription.nextBillingDate).diff(
          moment(),
          'days',
        );
        const dayText =
          daysUntilCharge === 0
            ? 'today'
            : daysUntilCharge === 1
            ? 'tomorrow'
            : `in ${daysUntilCharge} days`;

        notifications.push({
          to: user.token,
          sound: 'default',
          title: '📆 Subscription Reminder',
          body: `🔄 ${
            subscription.description
          } - $${subscription.amount.toFixed(
            2,
          )} will be charged ${dayText}. Current balance: $${wallet.balance.toFixed(
            2,
          )}.`,
        });
      }
    }

    if (notifications.length > 0) {
      await this.notificationService.sendChunkNotifications(notifications);
    }
  }

  // Unusual spending detection at 8 PM
  @Cron('0 20 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async unusualSpendingAlert() {
    const users = await this.notificationService.findAll();
    const notifications = [] as ExpoPushMessage[];

    for (const user of users) {
      if (!user.token || user.isEnable === false) continue;

      const today = moment().format('YYYY-MM-DD');
      const todayRange = [today, today] as [string, string];
      const [todayStats] = await this.walletService.getStatistics(
        user.userId,
        todayRange,
      );

      if (!todayStats || todayStats.expense <= 0) continue;

      // Get average daily spending for the last 30 days
      const lastMonthStart = moment().subtract(30, 'days').format('YYYY-MM-DD');
      const monthRange = [
        lastMonthStart,
        moment().subtract(1, 'day').format('YYYY-MM-DD'),
      ] as [string, string];
      const [monthStats] = await this.walletService.getStatistics(
        user.userId,
        monthRange,
      );

      if (!monthStats) continue;

      const averageDailySpending = monthStats.expense / 30;

      // Check if today's spending is significantly higher (2x) than average
      if (
        todayStats.expense > averageDailySpending * 2 &&
        todayStats.expense > 20
      ) {
        notifications.push({
          to: user.token,
          sound: 'default',
          title: '⚠️ Unusual Spending Detected',
          body: `📈 $${todayStats.expense.toFixed(2)} spent today is ${(
            todayStats.expense / averageDailySpending
          ).toFixed(1)}x your daily average of $${averageDailySpending.toFixed(
            2,
          )}!`,
        });
      }
    }

    if (notifications.length > 0) {
      await this.notificationService.sendChunkNotifications(notifications);
    }
  }
}

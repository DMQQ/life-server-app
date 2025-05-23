import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WalletService } from '../wallet.service';
import { LimitsService } from '../limits.service';
import { SubscriptionService } from '../subscriptions.service';
import { ExpenseService } from '../expense.service';
import { ExpoPushMessage } from 'expo-server-sdk';
import { ExpenseType, LimitRange } from '../wallet.entity';
import * as moment from 'moment';

@Injectable()
export class AlertsSchedulerService {
  private readonly logger = new Logger(AlertsSchedulerService.name);

  constructor(
    private notificationService: NotificationsService,
    private walletService: WalletService,
    private limitsService: LimitsService,
    private subscriptionService: SubscriptionService,
    private expenseService: ExpenseService,
  ) {}

  // Budget Alerts at 10 AM
  @Cron('0 10 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async budgetAlerts() {
    this.logger.log('Running budget alerts notifications');
    const users = await this.notificationService.findAll();
    const notifications = [] as ExpoPushMessage[];

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const wallet = await this.walletService.findWalletId(user.userId);
        if (!wallet) continue;

        // Get all monthly limits
        const monthlyLimits = (await this.limitsService.limits(wallet.id, LimitRange.monthly)) as any;

        // Check for limits approaching threshold
        const daysLeftInMonth = moment().endOf('month').diff(moment(), 'days');

        for (const limit of monthlyLimits) {
          const percentUsed = (limit.current / limit.amount) * 100;

          if (percentUsed >= 70 && percentUsed < 100) {
            const remaining = limit.amount - limit.current;

            notifications.push({
              to: user.token,
              sound: 'default',
              title: '⚠️ Budget Alert',
              body: `💸 ${limit.category} at ${percentUsed.toFixed(0)}% of monthly limit. ${remaining.toFixed(
                2,
              )}zł remaining for the next ${daysLeftInMonth} days.`,
            });
            this.notificationService.saveNotification(user.userId, notifications[notifications.length - 1]);

            break; // Only send one limit alert per day
          }
        }

        if (wallet.balance < 100) {
          try {
            const lastMonth = moment().subtract(1, 'month').format('YYYY-MM-DD');
            const today = moment().format('YYYY-MM-DD');
            const monthRange = { from: lastMonth, to: today };

            const recentExpenses = await this.expenseService.getExpenses(user.userId, monthRange);
            const incomes = recentExpenses.filter((exp) => exp.type === ExpenseType.income);

            let daysToIncome = 7; // Default assumption
            if (incomes.length > 0) {
              // Sort by date, most recent first
              incomes.sort((a, b) => moment(b.date).valueOf() - moment(a.date).valueOf());
              const lastIncomeDate = moment(incomes[0].date);

              // If we have a regular monthly pattern, predict next income
              if (incomes.length >= 2) {
                const secondLastIncomeDate = moment(incomes[1].date);
                const daysBetweenIncomes = lastIncomeDate.diff(secondLastIncomeDate, 'days');
                if (daysBetweenIncomes > 20 && daysBetweenIncomes < 35) {
                  // Likely monthly income
                  const nextPredictedIncome = lastIncomeDate.clone().add(daysBetweenIncomes, 'days');
                  daysToIncome = nextPredictedIncome.diff(moment(), 'days');
                  if (daysToIncome < 0) daysToIncome = 7; // Fallback if prediction is in the past
                }
              }
            }

            notifications.push({
              to: user.token,
              sound: 'default',
              title: '⚠️ Low Balance Warning',
              body: `💰 ${wallet.balance.toFixed(
                2,
              )}zł remaining. ${daysToIncome} days until next predicted income. Plan your expenses carefully!`,
            });
            this.notificationService.saveNotification(user.userId, notifications[notifications.length - 1]);
          } catch (error) {
            this.logger.error(`Error processing low balance alert for user ${user.userId}: ${error.message}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error processing budget alerts for user ${user.userId}: ${error.message}`);
      }
    }

    if (notifications.length > 0) {
      try {
        await this.notificationService.sendChunkNotifications(notifications);
      } catch (error) {
        this.logger.error(`Error sending budget alerts notifications: ${error.message}`);
      }
    }
  }

  // Subscription Reminders at 9 AM
  @Cron('0 9 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async subscriptionReminders() {
    this.logger.log('Running subscription reminders notifications');
    const users = await this.notificationService.findAll();
    const notifications = [] as ExpoPushMessage[];

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const wallet = await this.walletService.findWalletId(user.userId);
        if (!wallet) continue;

        // Get all active subscriptions
        const now = new Date();
        const threeDaysLater = moment().add(3, 'days').toDate();

        // Get all subscriptions
        const allSubscriptions = await this.subscriptionService.getAllSubscriptions();

        // Filter subscriptions for this user's wallet with upcoming billing
        const upcomingSubscriptions = allSubscriptions.filter(
          (sub) =>
            sub.walletId === wallet.id &&
            sub.isActive &&
            sub.nextBillingDate >= now &&
            sub.nextBillingDate <= threeDaysLater,
        );

        for (const subscription of upcomingSubscriptions) {
          try {
            const daysUntilCharge = moment(subscription.nextBillingDate).diff(moment(), 'days');
            const dayText =
              daysUntilCharge === 0 ? 'today' : daysUntilCharge === 1 ? 'tomorrow' : `in ${daysUntilCharge} days`;

            notifications.push({
              to: user.token,
              sound: 'default',
              title: '📆 Subscription Reminder',
              body: `🔄 ${subscription.description} - ${subscription.amount.toFixed(
                2,
              )}zł will be charged ${dayText}. Current balance: ${wallet.balance.toFixed(2)}zł.`,
            });
            this.notificationService.saveNotification(user.userId, notifications[notifications.length - 1]);
          } catch (error) {
            this.logger.error(
              `Error processing subscription ${subscription.id} for user ${user.userId}: ${error.message}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(`Error processing subscription reminders for user ${user.userId}: ${error.message}`);
      }
    }

    if (notifications.length > 0) {
      try {
        await this.notificationService.sendChunkNotifications(notifications);
      } catch (error) {
        this.logger.error(`Error sending subscription reminder notifications: ${error.message}`);
      }
    }
  }
}

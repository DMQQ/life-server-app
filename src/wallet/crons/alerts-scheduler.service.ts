import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as dayjs from 'dayjs';
import { ExpoPushMessage } from 'expo-server-sdk';
import { NotificationsService } from 'src/notifications/notifications.service';
import { formatCategory } from 'src/utils/fns/format-category';
import { ExpenseType, LimitRange } from '../entities/wallet.entity';
import { ExpenseService } from '../services/expense.service';
import { LimitsService } from '../services/limits.service';
import { SubscriptionService } from '../services/subscriptions.service';
import { WalletService } from '../services/wallet.service';
import { BaseScheduler } from '../../notifications/scheduler-base.service';

@Injectable()
export class AlertsSchedulerService extends BaseScheduler {
  constructor(
    notificationService: NotificationsService,
    private walletService: WalletService,
    private limitsService: LimitsService,
    private subscriptionService: SubscriptionService,
    private expenseService: ExpenseService,
  ) {
    super(notificationService);
  }

  // Budget Alerts at 10 AM
  @Cron('0 7 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async budgetAlerts() {
    this.logger.log('Running budget alerts notifications');

    this.forEachNotification('budgetAlerts', async (user) => {
      try {
        const wallet = await this.walletService.findWalletId(user.userId);

        // Get all monthly limits
        const monthlyLimits = (await this.limitsService.limits(
          wallet.id,
          LimitRange.monthly,
          dayjs().format('YYYY-MM-DD'),
        )) as any;

        // Check for limits approaching threshold
        const daysLeftInMonth = dayjs().endOf('month').diff(dayjs(), 'days');

        for (const limit of monthlyLimits) {
          const percentUsed = (limit.current / limit.amount) * 100;

          if (percentUsed >= 70 && percentUsed < 100) {
            const remaining = limit.amount - limit.current;

            const notification = {
              to: user.token,
              sound: 'default',
              title: '⚠️ Budget Alert',
              body: `💸 ${formatCategory(limit.category)} at ${percentUsed.toFixed(0)}% of monthly limit. ${remaining.toFixed(
                2,
              )}zł remaining for the next ${daysLeftInMonth} days.`,
            } as ExpoPushMessage;

            return notification;
          }
        }

        if (wallet.balance < 100) {
          try {
            const lastMonth = dayjs().subtract(1, 'month').format('YYYY-MM-DD');
            const today = dayjs().format('YYYY-MM-DD');
            const monthRange = { from: lastMonth, to: today };

            const recentExpenses = await this.expenseService.getExpenses(user.userId, monthRange);
            const incomes = recentExpenses.filter((exp) => exp.type === ExpenseType.income);

            let daysToIncome = 7; // Default assumption
            if (incomes.length > 0) {
              // Sort by date, most recent first
              incomes.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
              const lastIncomeDate = dayjs(incomes[0].date);

              // If we have a regular monthly pattern, predict next income
              if (incomes.length >= 2) {
                const secondLastIncomeDate = dayjs(incomes[1].date);
                const daysBetweenIncomes = lastIncomeDate.diff(secondLastIncomeDate, 'days');
                if (daysBetweenIncomes > 20 && daysBetweenIncomes < 35) {
                  // Likely monthly income
                  const nextPredictedIncome = lastIncomeDate.clone().add(daysBetweenIncomes, 'days');
                  daysToIncome = nextPredictedIncome.diff(dayjs(), 'days');
                  if (daysToIncome < 0) daysToIncome = 7; // Fallback if prediction is in the past
                }
              }
            }

            const notification = {
              to: user.token,
              sound: 'default',
              title: '⚠️ Low Balance Warning',
              body: `💰 ${wallet.balance.toFixed(
                2,
              )}zł remaining. ${daysToIncome} days until next predicted income. Plan your expenses carefully!`,
            } as ExpoPushMessage;

            return notification;
          } catch (error) {
            this.logger.error(`Error processing low balance alert for user ${user.userId}: ${error.message}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error processing budget alerts for user ${user.userId}: ${error.message}`);
        return null;
      }
    });
  }

  // Subscription Reminders at 9 AM
  @Cron('0 9 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async subscriptionReminders() {
    this.logger.log('Running subscription reminders notifications');

    this.forEachNotification('subscriptionReminders', async (user) => {
      try {
        const wallet = await this.walletService.findWalletId(user.userId);
        if (!wallet) return null;

        const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
        const subscriptionsDueTomorrow = await this.subscriptionService.getSubscriptionsDueOn(wallet.id, tomorrow);

        if (subscriptionsDueTomorrow.length === 0) return null;

        if (subscriptionsDueTomorrow.length === 1) {
          const subscription = subscriptionsDueTomorrow[0];
          const hasEnoughBalance = wallet.balance >= subscription.amount;
          
          return {
            to: user.token,
            sound: 'default',
            title: '📆 Subscription Reminder',
            body: `🔄 ${subscription.description} - ${subscription.amount.toFixed(2)}zł will be charged tomorrow.${
              hasEnoughBalance 
                ? '' 
                : ` ⚠️ Insufficient balance! Current: ${wallet.balance.toFixed(2)}zł`
            }`,
            data: {
              type: 'subscription_reminder',
              subscriptionId: subscription.id,
              amount: subscription.amount,
              hasEnoughBalance
            }
          } as ExpoPushMessage;
        } else {
          const totalAmount = subscriptionsDueTomorrow.reduce((sum, sub) => sum + sub.amount, 0);
          const hasEnoughBalance = wallet.balance >= totalAmount;
          
          return {
            to: user.token,
            sound: 'default',
            title: '📆 Multiple Subscriptions Due',
            body: `🔄 ${subscriptionsDueTomorrow.length} subscriptions (${totalAmount.toFixed(2)}zł total) due tomorrow.${
              hasEnoughBalance 
                ? '' 
                : ` ⚠️ Insufficient balance! Current: ${wallet.balance.toFixed(2)}zł`
            }`,
            data: {
              type: 'multiple_subscriptions_reminder',
              count: subscriptionsDueTomorrow.length,
              totalAmount,
              hasEnoughBalance
            }
          } as ExpoPushMessage;
        }
      } catch (error) {
        this.logger.error(`Error processing subscription reminders for user ${user.userId}: ${error.message}`);
        return null;
      }
    });
  }
}

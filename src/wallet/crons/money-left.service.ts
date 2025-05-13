import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WalletService } from '../wallet.service';
import { ExpenseService } from '../expense.service';
import { ExpoPushMessage } from 'expo-server-sdk';
import { ExpenseType, LimitRange } from '../wallet.entity';
import * as moment from 'moment';
import { LimitsService } from '../limits.service';
import { SubscriptionService } from '../subscriptions.service';
import { BaseScheduler } from './scheduler-base.service';

@Injectable()
export class MoneyLeftSchedulerService extends BaseScheduler {
  constructor(
    notificationService: NotificationsService,
    walletService: WalletService,
    expenseService: ExpenseService,
    limitsService: LimitsService,
  ) {
    super(notificationService);
    this.walletService = walletService;
    this.expenseService = expenseService;
    this.notificationService = notificationService;
    this.limitsService = limitsService;
  }
  private walletService: WalletService;
  private expenseService: ExpenseService;

  private limitsService: LimitsService;

  //   @Cron('0 8 * * *', {
  //     timeZone: 'Europe/Warsaw',
  //   })
  @Interval(10_000)
  async moneyLeftToday() {
    this.logger.log('Running Money Left Today notifications');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const wallet = await this.walletService.getWalletByUserId(user.userId);
        const walletId = wallet.id;
        if (!wallet) continue;

        const today = moment().format('YYYY-MM-DD');

        const daysLeftInMonth = moment().endOf('month').diff(moment(), 'days') + 1; // +1 to include today
        const daysLeftInWeek = 7 - moment().day();

        let monthlyBudget = wallet.income * (wallet.monthlyPercentageTarget / 100);

        if (!monthlyBudget || monthlyBudget <= 0) {
          try {
            const limits = await this.limitsService.findAllWallet(walletId, LimitRange.monthly);
            if (limits && limits.length > 0) {
              monthlyBudget = limits.reduce((sum, limit) => sum + limit.amount, 0);
            }
          } catch (error) {
            this.logger.error(`Error getting limits for user ${user.userId}: ${error.message}`);
          }

          if (monthlyBudget <= 0) {
            try {
              const threeMonthsAgo = moment().subtract(3, 'months').format('YYYY-MM-DD');
              const monthlyData = await this.expenseService.getMonthIncomesAndExpenses(walletId, [
                threeMonthsAgo,
                today,
              ]);

              if (monthlyData && monthlyData.expense > 0) {
                monthlyBudget = monthlyData.expense / 3;
              }
            } catch (error) {
              this.logger.error(`Error estimating monthly budget for user ${user.userId}: ${error.message}`);
            }
          }

          if (monthlyBudget <= 0) {
            monthlyBudget = wallet.balance * 0.7;
          }
        }

        const daysInMonth = moment().daysInMonth();
        const dailyBudget = monthlyBudget / daysInMonth;

        const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
        const monthToDate = await this.expenseService.getTotalExpensesForPeriod(walletId, [startOfMonth, today]);
        const spentThisMonth = monthToDate.expense_sum || 0;

        const startOfWeek = moment().startOf('week').add(1, 'day').format('YYYY-MM-DD');
        const weekToDate = await this.expenseService.getTotalExpensesForPeriod(walletId, [startOfWeek, today]);
        const spentThisWeek = weekToDate.expense_sum || 0;

        const todayExpenses = await this.expenseService.getTotalExpensesForPeriod(walletId, [today, today]);
        const spentToday = todayExpenses.expense_sum || 0;

        const remainingMonthlyBudget = Math.max(0, monthlyBudget - spentThisMonth);
        const weeksLeftInMonth = daysLeftInMonth / 7;
        const adjustedWeeklyBudget = remainingMonthlyBudget / weeksLeftInMonth;
        const remainingWeeklyBudget = Math.max(0, adjustedWeeklyBudget - spentThisWeek);
        const remainingDailyBudget = Math.max(0, dailyBudget - spentToday);

        const dailyFromMonthly = daysLeftInMonth > 0 ? remainingMonthlyBudget / daysLeftInMonth : 0;
        const dailyFromWeekly = daysLeftInWeek > 0 ? remainingWeeklyBudget / daysLeftInWeek : 0;

        const canSpendToday = Math.min(remainingDailyBudget, dailyFromWeekly, dailyFromMonthly);

        let messageBody = '';
        let constraint = '';

        if (canSpendToday === remainingDailyBudget) {
          constraint = 'daily';
        } else if (canSpendToday === dailyFromWeekly) {
          constraint = 'weekly';
        } else {
          constraint = 'monthly';
        }

        const dayOfWeek = moment().day();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (canSpendToday < 10) {
          if (isWeekend) {
            messageBody = `⚠️ Weekend budget alert! Only ${canSpendToday.toFixed(
              2,
            )}zł left to spend today based on your ${constraint} budget. Balance: ${wallet.balance.toFixed(2)}zł.`;
          } else {
            messageBody = `⚠️ Budget tight! You have ${canSpendToday.toFixed(
              2,
            )}zł left to spend today based on your ${constraint} budget. Total balance: ${wallet.balance.toFixed(
              2,
            )}zł.`;
          }
        } else {
          if (isWeekend) {
            messageBody = `🎉 Weekend spending: You can spend ${canSpendToday.toFixed(
              2,
            )}zł today. Weekly: ${remainingWeeklyBudget.toFixed(2)}zł, Monthly: ${remainingMonthlyBudget.toFixed(
              2,
            )}zł remaining.`;
          } else {
            messageBody = `💰 You can spend ${canSpendToday.toFixed(
              2,
            )}zł today to stay on ${constraint} budget. Weekly: ${remainingWeeklyBudget.toFixed(
              2,
            )}zł, Monthly: ${remainingMonthlyBudget.toFixed(2)}zł left.`;
          }
        }

        await this.sendSingleNotification({
          to: user.token,
          sound: 'default',
          title: "📅 Today's Budget",
          body: this.truncateNotification(messageBody),
        });
      } catch (error) {
        this.logger.error(
          `Error processing money left notification for user ${user.userId}: ${error.message}`,
          error.stack,
        );
      }
    }
  }
}

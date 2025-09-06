import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as dayjs from 'dayjs';
import { ExpoPushMessage } from 'expo-server-sdk';
import { NotificationsService } from 'src/notifications/notifications.service';
import { LimitRange } from '../entities/wallet.entity';
import { ExpenseService } from '../services/expense.service';
import { LimitsService } from '../services/limits.service';
import { WalletService } from '../services/wallet.service';
import { BaseScheduler } from '../../notifications/scheduler-base.service';

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

  @Cron('0 7 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async moneyLeftToday() {
    this.logger.log('Running Money Left Today notifications');

    this.forEachNotification('moneyLeftToday', async (user) => {
      try {
        const wallet = await this.walletService.getWalletByUserId(user.userId);
        const walletId = wallet.id;
        if (!wallet) return null;

        const today = dayjs().format('YYYY-MM-DD');

        const daysLeftInMonth = dayjs().endOf('month').diff(dayjs(), 'day') + 1;
        const daysLeftInWeek = 7 - dayjs().day();

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
              const threeMonthsAgo = dayjs().subtract(3, 'month').format('YYYY-MM-DD');
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

        const daysInMonth = dayjs().daysInMonth();
        const dailyBudget = monthlyBudget / daysInMonth;

        const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
        const monthToDate = await this.expenseService.getTotalExpensesForPeriod(walletId, [startOfMonth, today]);
        const spentThisMonth = monthToDate.expense_sum || 0;

        const startOfWeek = dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD');
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

        const dayOfWeek = dayjs().day();
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
        return {
          to: user.token,
          sound: 'default',
          title: "📅 Today's Budget",
          body: this.truncateNotification(messageBody),
        } as ExpoPushMessage;
      } catch (error) {
        this.logger.error(
          `Error processing money left notification for user ${user.userId}: ${error.message}`,
          error.stack,
        );
        return null;
      }
    });
  }
}

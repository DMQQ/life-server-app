import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WalletService } from '../wallet.service';
import { ExpenseService } from '../expense.service';
import { ExpoPushMessage } from 'expo-server-sdk';
import { ExpenseType } from '../wallet.entity';
import * as moment from 'moment';

@Injectable()
export class InsightsSchedulerService {
  private readonly logger = new Logger(InsightsSchedulerService.name);

  constructor(
    private notificationService: NotificationsService,
    private walletService: WalletService,
    private expenseService: ExpenseService,
  ) {}

  @Cron('0 20 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async getDailyInsights() {
    const notifications = await this.notificationService.findAll();

    for (const n of notifications) {
      try {
        if (n.isEnable === false || !n.token) continue;

        const walletId = await this.walletService.getWalletId(n.userId);
        if (!walletId) continue;

        const wallet = await this.walletService.getWallet(walletId);

        const [today, yesterday] = await Promise.all([
          this.expenseService.getDailyInsights(walletId, [
            moment().startOf('day').format('YYYY-MM-DD HH:MM:ss'),
            moment().endOf('day').format('YYYY-MM-DD HH:MM:ss'),
          ]),
          this.expenseService.getDailyInsights(walletId, [
            moment().startOf('day').subtract(1, 'd').format('YYYY-MM-DD HH:MM:ss'),
            moment().endOf('day').subtract(1, 'd').format('YYYY-MM-DD HH:MM:ss'),
          ]),
        ]);

        let messageBody = '';
        const todayExpense = today.expense_sum || 0;
        const yesterdayExpense = yesterday.expense_sum || 0;
        const todayCount = parseInt(today.transaction_count || '0');
        const balance = wallet.balance;

        if (todayExpense <= 0) {
          messageBody = `📉 No spending recorded today! ${
            yesterdayExpense > 0 ? `You spent ${yesterdayExpense.toFixed(2)}zł yesterday.` : 'Keep it up!'
          } Balance: ${balance.toFixed(2)}zł`;
        } else {
          let percentChange = 0;
          let changeText = '';

          if (yesterdayExpense > 0) {
            percentChange = ((todayExpense - yesterdayExpense) / yesterdayExpense) * 100;
            const isMore = percentChange > 0;
            changeText = `${Math.abs(percentChange).toFixed(0)}% ${isMore ? 'more 📈' : 'less 📉'} than yesterday`;
          }

          messageBody = `💰 Spent ${todayExpense.toFixed(2)}zł today on ${todayCount} transaction${
            todayCount !== 1 ? 's' : ''
          }. ${yesterdayExpense > 0 ? changeText + '.' : ''} Balance: ${balance.toFixed(2)}zł`;
        }

        if (messageBody.length > 178) {
          messageBody = messageBody.substring(0, 175) + '...';
        }

        await this.notificationService.sendChunkNotifications([
          {
            to: n.token,
            sound: 'default',
            title: '📱 Daily Finance Update',
            body: messageBody,
          },
        ]);
      } catch (error) {
        console.error(`Error processing insights for user ${n.userId}:`, error);
      }
    }
  }

  @Cron('0 18 * * 1', {
    timeZone: 'Europe/Warsaw',
  })
  async spendingPatternInsights() {
    const notifications = await this.notificationService.findAll();

    for (const n of notifications) {
      try {
        if (n.isEnable === false || !n.token) continue;

        const walletId = await this.walletService.getWalletId(n.userId);
        if (!walletId) continue;

        const startDate = moment().subtract(1, 'month').format('YYYY-MM-DD');
        const endDate = moment().format('YYYY-MM-DD');

        const hourlyData = await this.expenseService.getHourlySpendingPatterns(walletId, [startDate, endDate]);

        if (!hourlyData || hourlyData.length === 0) continue;

        let maxHour = -1;
        let maxAvgAmount = 0;
        let maxCount = 0;

        for (const hour of hourlyData) {
          if (hour.count >= 5 && hour.avg_amount > maxAvgAmount) {
            maxHour = hour.hour;
            maxAvgAmount = hour.avg_amount;
            maxCount = hour.count;
          }
        }

        if (maxHour === -1) continue;

        const topCategory = await this.expenseService.getTopCategoryForHour(walletId, maxHour, [startDate, endDate]);

        const hour12 = maxHour % 12 || 12;
        const ampm = maxHour >= 12 ? 'PM' : 'AM';
        const timeStr = `${hour12}${ampm}`;

        const messageBody = `⏰ You tend to make more purchases around ${timeStr}, spending an average of ${maxAvgAmount.toFixed(
          2,
        )}zł${topCategory ? `. Most common category: ${topCategory}` : ''}.`;

        const truncatedBody = messageBody.length > 178 ? messageBody.substring(0, 175) + '...' : messageBody;

        await this.notificationService.sendChunkNotifications([
          {
            to: n.token,
            sound: 'default',
            title: '🔍 Spending Pattern Detected',
            body: truncatedBody,
          },
        ]);
      } catch (error) {
        console.error(`Error processing spending patterns for user ${n.userId}:`, error);
      }
    }
  }

  @Cron('0 19 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async unusualSpendingAlert() {
    const notifications = await this.notificationService.findAll();

    for (const n of notifications) {
      try {
        if (n.isEnable === false || !n.token) continue;

        const walletId = await this.walletService.getWalletId(n.userId);
        if (!walletId) continue;

        const todayData = await this.expenseService.getDailyInsights(walletId, [
          moment().startOf('day').format('YYYY-MM-DD HH:MM:ss'),
          moment().endOf('day').format('YYYY-MM-DD HH:MM:ss'),
        ]);

        const todayExpense = todayData.expense_sum || 0;

        if (todayExpense <= 0) continue;

        const lastMonthStart = moment().subtract(30, 'days').format('YYYY-MM-DD');
        const yesterdayEnd = moment().subtract(1, 'day').format('YYYY-MM-DD');

        const monthlyData = await this.expenseService.getTotalExpensesForPeriod(walletId, [
          moment(lastMonthStart).startOf('day').format('YYYY-MM-DD HH:MM:ss'),
          moment(yesterdayEnd).endOf('day').format('YYYY-MM-DD HH:MM:ss'),
        ]);

        const monthlyTotal = monthlyData.expense_sum || 0;
        const daysInPeriod = moment(yesterdayEnd).diff(moment(lastMonthStart), 'days') + 1;
        const averageDaily = monthlyTotal / Math.max(1, daysInPeriod);

        if (todayExpense > averageDaily * 2 && todayExpense >= 20) {
          const ratio = todayExpense / averageDaily;

          const messageBody = `📈 ${todayExpense.toFixed(2)}zł spent today is ${ratio.toFixed(
            1,
          )}x your daily average of $${averageDaily.toFixed(2)}!`;

          await this.notificationService.sendChunkNotifications([
            {
              to: n.token,
              sound: 'default',
              title: '⚠️ Unusual Spending Detected',
              body: messageBody,
            },
          ]);
        }
      } catch (error) {
        console.error(`Error processing unusual spending alert for user ${n.userId}:`, error);
      }
    }
  }
}

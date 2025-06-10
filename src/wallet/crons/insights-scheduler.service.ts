import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WalletService } from '../wallet.service';
import { ExpenseService } from '../expense.service';
import { ExpoPushMessage } from 'expo-server-sdk';
import { ExpenseType, LimitRange } from '../wallet.entity';
import * as dayjs from 'dayjs';
import { LimitsService } from '../limits.service';
import { SubscriptionService } from '../subscriptions.service';
import { BaseScheduler } from './scheduler-base.service';

@Injectable()
export class InsightsSchedulerService extends BaseScheduler {
  constructor(
    walletService: WalletService,
    expenseService: ExpenseService,
    subscriptionSerivce: SubscriptionService,
    notificationService: NotificationsService,
  ) {
    super(notificationService);
    this.walletService = walletService;
    this.expenseService = expenseService;
    this.subscriptionSerivce = subscriptionSerivce;
  }

  private walletService: WalletService;
  private expenseService: ExpenseService;
  private subscriptionSerivce: SubscriptionService;

  @Cron('0 22 * * *', {
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
            dayjs().startOf('day').format('YYYY-MM-DD HH:MM:ss'),
            dayjs().endOf('day').format('YYYY-MM-DD HH:MM:ss'),
          ]),
          this.expenseService.getDailyInsights(walletId, [
            dayjs().startOf('day').subtract(1, 'day').format('YYYY-MM-DD HH:MM:ss'),
            dayjs().endOf('day').subtract(1, 'day').format('YYYY-MM-DD HH:MM:ss'),
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

        const notification = {
          to: n.token,
          sound: 'default',
          title: '📱 Daily Finance Update',
          body: messageBody,
        } as ExpoPushMessage;

        await this.notificationService.sendChunkNotifications([notification]);

        await this.notificationService.saveNotification(n.userId, notification);
      } catch (error) {
        console.error(`Error processing insights for user ${n.userId}:`, error);
      }
    }
  }

  @Cron('0 22 * * 1', {
    timeZone: 'Europe/Warsaw',
  })
  async spendingPatternInsights() {
    const notifications = await this.notificationService.findAll();

    for (const n of notifications) {
      try {
        if (n.isEnable === false || !n.token) continue;

        const walletId = await this.walletService.getWalletId(n.userId);
        if (!walletId) continue;

        const startDate = dayjs().subtract(1, 'month').format('YYYY-MM-DD');
        const endDate = dayjs().format('YYYY-MM-DD');

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

        const notification = {
          to: n.token,
          sound: 'default',
          title: '🔍 Spending Pattern Detected',
          body: truncatedBody,
        } as ExpoPushMessage;

        await this.notificationService.sendChunkNotifications([notification]);
        await this.notificationService.saveNotification(n.userId, notification);
      } catch (error) {
        console.error(`Error processing spending patterns for user ${n.userId}:`, error);
      }
    }
  }

  @Cron('0 22 * * *', {
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
          dayjs().startOf('day').format('YYYY-MM-DD HH:MM:ss'),
          dayjs().endOf('day').format('YYYY-MM-DD HH:MM:ss'),
        ]);

        const todayExpense = todayData.expense_sum || 0;

        if (todayExpense <= 0) continue;

        const lastMonthStart = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
        const yesterdayEnd = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

        const monthlyData = await this.expenseService.getTotalExpensesForPeriod(walletId, [
          dayjs(lastMonthStart).startOf('day').format('YYYY-MM-DD HH:MM:ss'),
          dayjs(yesterdayEnd).endOf('day').format('YYYY-MM-DD HH:MM:ss'),
        ]);

        const monthlyTotal = monthlyData.expense_sum || 0;
        const daysInPeriod = dayjs(yesterdayEnd).diff(dayjs(lastMonthStart), 'day') + 1;
        const averageDaily = monthlyTotal / Math.max(1, daysInPeriod);

        if (todayExpense > averageDaily * 2 && todayExpense >= 20) {
          const ratio = todayExpense / averageDaily;

          const messageBody = `📈 ${todayExpense.toFixed(2)}zł spent today is ${ratio.toFixed(
            1,
          )}x your daily average of ${averageDaily.toFixed(2)}zł!`;

          const notification = {
            to: n.token,
            sound: 'default',
            title: '⚠️ Unusual Spending Detected',
            body: messageBody,
          } as ExpoPushMessage;

          await this.notificationService.sendChunkNotifications([notification]);
          await this.notificationService.saveNotification(n.userId, notification);
        }
      } catch (error) {
        console.error(`Error processing unusual spending alert for user ${n.userId}:`, error);
      }
    }
  }

  @Cron('0 22 * * 6', {
    timeZone: 'Europe/Warsaw',
  })
  async weekdayVsWeekendAnalysis() {
    this.logger.log('Running weekday vs weekend analysis');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) continue;

        const startDate = dayjs().subtract(28, 'day').format('YYYY-MM-DD');
        const endDate = dayjs().format('YYYY-MM-DD');

        const expenses = await this.expenseService.getExpensesForPeriod(walletId, [
          dayjs(startDate).startOf('day').format('YYYY-MM-DD HH:MM:ss'),
          dayjs(endDate).endOf('day').format('YYYY-MM-DD HH:MM:ss'),
        ]);

        if (!expenses || expenses.length < 10) {
          this.logger.log(`Not enough expenses for user ${user.userId} to analyze weekend patterns`);
          continue;
        }

        const weekdayExpenses = [];
        const weekendExpenses = [];

        for (const expense of expenses) {
          const date = dayjs(expense.date);
          const dayOfWeek = date.day();

          if (dayOfWeek === 0 || dayOfWeek === 6) {
            weekendExpenses.push(expense);
          } else {
            weekdayExpenses.push(expense);
          }
        }

        if (weekdayExpenses.length < 5 || weekendExpenses.length < 3) {
          continue;
        }

        const weekdayTotal = weekdayExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
        const weekendTotal = weekendExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

        const totalDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
        const weekendDays = Math.round((totalDays * 2) / 7);
        const weekdayDays = totalDays - weekendDays;

        const avgWeekdaySpending = weekdayTotal / weekdayDays;
        const avgWeekendSpending = weekendTotal / weekendDays;

        const percentDiff = ((avgWeekendSpending - avgWeekdaySpending) / avgWeekdaySpending) * 100;
        const isMoreOnWeekends = percentDiff > 0;

        if (Math.abs(percentDiff) >= 20) {
          const savingsTip = isMoreOnWeekends
            ? `If you reduced weekend spending to weekday levels, you could save ~${(
                (avgWeekendSpending - avgWeekdaySpending) *
                2 *
                4
              ).toFixed(2)}zł monthly.`
            : `You're already spending less on weekends - great budget control!`;

          const messageBody = `📅 Weekend vs Weekday: You spend ${Math.abs(percentDiff).toFixed(0)}% ${
            isMoreOnWeekends ? 'more' : 'less'
          } on weekends than weekdays. ${savingsTip}`;

          const notification = {
            to: user.token,
            sound: 'default',
            title: '💰 Spending Pattern Analysis',
            body: this.truncateNotification(messageBody),
          } as ExpoPushMessage;

          await this.sendSingleNotification(notification);
          await this.notificationService.saveNotification(user.userId, notification);
        }
      } catch (error) {
        this.logger.error(`Error processing weekend analysis for user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  @Cron('0 22 * * 0', {
    timeZone: 'Europe/Warsaw',
  })
  async topSpendingDayAnalysis() {
    this.logger.log('Running top spending day analysis');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) continue;

        const startDate = dayjs().subtract(6, 'week').format('YYYY-MM-DD');
        const endDate = dayjs().format('YYYY-MM-DD');

        const dayOfWeekData = await this.expenseService.getSpendingByDayOfWeek(walletId, [startDate, endDate]);

        if (!dayOfWeekData || dayOfWeekData.length === 0) {
          continue;
        }

        let highestAvgDay = -1;
        let highestAvg = 0;
        let lowestAvgDay = -1;
        let lowestAvg = Number.MAX_VALUE;

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        for (const day of dayOfWeekData) {
          if (day.count >= 3) {
            if (day.avg_amount > highestAvg) {
              highestAvg = day.avg_amount;
              highestAvgDay = day.day_of_week;
            }

            if (day.avg_amount < lowestAvg) {
              lowestAvg = day.avg_amount;
              lowestAvgDay = day.day_of_week;
            }
          }
        }

        if (highestAvgDay === -1 || lowestAvgDay === -1) {
          continue;
        }

        const percentDiff = ((highestAvg - lowestAvg) / lowestAvg) * 100;

        if (percentDiff >= 25) {
          const weeklySavingsPotential = highestAvg - lowestAvg;
          const annualSavings = weeklySavingsPotential * 52;

          const messageBody = `📊 Your top spending day is ${dayNames[highestAvgDay]}. Tip: Plan purchases for ${
            dayNames[lowestAvgDay]
          } when you spend ${percentDiff.toFixed(0)}% less. Potential yearly savings: ${annualSavings.toFixed(0)}zł.`;

          const notification = {
            to: user.token,
            sound: 'default',
            title: '💸 Spending Day Insight',
            body: this.truncateNotification(messageBody),
          } as ExpoPushMessage;

          await this.sendSingleNotification(notification);
          await this.notificationService.saveNotification(user.userId, notification);
        }
      } catch (error) {
        this.logger.error(`Error processing top spending day for user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  @Cron('0 22 26 * *', {
    timeZone: 'Europe/Warsaw',
  })
  async monthlyCategoryComparison() {
    this.logger.log('Running monthly category comparison');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) continue;

        const currentMonth = dayjs().format('YYYY-MM');
        const lastMonth = dayjs().subtract(1, 'month').format('YYYY-MM');

        const monthlyData = await this.expenseService.getMonthlyCategories(walletId, [lastMonth, currentMonth]);

        if (!monthlyData || monthlyData.length !== 2) {
          continue;
        }

        const lastMonthCategories = {};
        const currentMonthCategories = {};

        monthlyData[0].categories.forEach((cat) => {
          lastMonthCategories[cat.category] = parseFloat(cat.total);
        });

        monthlyData[1].categories.forEach((cat) => {
          currentMonthCategories[cat.category] = parseFloat(cat.total);
        });

        let biggestIncrease = { category: '', change: 0 };
        let biggestDecrease = { category: '', change: 0 };

        for (const category in currentMonthCategories) {
          if (lastMonthCategories[category]) {
            const change = currentMonthCategories[category] - lastMonthCategories[category];

            if (Math.abs(change) >= 20) {
              if (change > 0 && change > biggestIncrease.change) {
                biggestIncrease = { category, change };
              } else if (change < 0 && change < biggestDecrease.change) {
                biggestDecrease = { category, change: Math.abs(change) };
              }
            }
          }
        }

        let messageBody = '';

        if (biggestIncrease.category && biggestDecrease.category) {
          const yearlyImpact = (biggestIncrease.change - biggestDecrease.change) * 12;

          messageBody = `📊 This month vs last: You've spent ${biggestDecrease.change.toFixed(2)}zł less on ${
            biggestDecrease.category
          } but ${biggestIncrease.change.toFixed(2)}zł more on ${biggestIncrease.category}. Yearly impact: ${
            yearlyImpact > 0 ? '+' : ''
          }${yearlyImpact.toFixed(0)}zł.`;
        } else if (biggestDecrease.category) {
          const yearlySavings = biggestDecrease.change * 12;

          messageBody = `📉 Great job! You've spent ${biggestDecrease.change.toFixed(2)}zł less on ${
            biggestDecrease.category
          } this month. If continued, that's ${yearlySavings.toFixed(0)}zł saved yearly!`;
        } else if (biggestIncrease.category) {
          const yearlyCost = biggestIncrease.change * 12;

          messageBody = `📈 Spending alert: ${biggestIncrease.change.toFixed(2)}zł increase on ${
            biggestIncrease.category
          } this month. If this continues, it adds ${yearlyCost.toFixed(0)}zł yearly to your expenses.`;
        }

        if (messageBody) {
          const notification = {
            to: user.token,
            sound: 'default',
            title: '📆 Monthly Category Report',
            body: this.truncateNotification(messageBody),
          } as ExpoPushMessage;
          await this.sendSingleNotification(notification);
          await this.notificationService.saveNotification(user.userId, notification);
        }
      } catch (error) {
        this.logger.error(`Error processing monthly comparison for user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  @Cron('0 22 28-31 * *', {
    timeZone: 'Europe/Warsaw',
  })
  async savingRateAnalysis() {
    if (!dayjs().isSame(dayjs().endOf('month'), 'day')) {
      return;
    }

    this.logger.log('Running saving rate analysis');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) continue;

        const currentMonthStart = dayjs().startOf('month').format('YYYY-MM-DD');
        const currentMonthEnd = dayjs().endOf('month').format('YYYY-MM-DD');
        const prevMonthStart = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        const prevMonthEnd = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');

        const currentMonth = await this.expenseService.getMonthIncomesAndExpenses(walletId, [
          currentMonthStart,
          currentMonthEnd,
        ]);

        const prevMonth = await this.expenseService.getMonthIncomesAndExpenses(walletId, [
          prevMonthStart,
          prevMonthEnd,
        ]);

        if (!currentMonth || !prevMonth) {
          continue;
        }

        const currentSavingRate =
          currentMonth.income > 0 ? ((currentMonth.income - currentMonth.expense) / currentMonth.income) * 100 : 0;

        const prevSavingRate =
          prevMonth.income > 0 ? ((prevMonth.income - prevMonth.expense) / prevMonth.income) * 100 : 0;

        if (currentMonth.income <= 0 || prevMonth.income <= 0) {
          continue;
        }

        const monthlySavings = currentMonth.income - currentMonth.expense;

        const yearlyInvestment = Math.max(0, monthlySavings * 12);

        let messageBody = '';

        if (currentSavingRate >= prevSavingRate) {
          messageBody = `📈 Saving rate: ${currentSavingRate.toFixed(1)}% this month vs ${prevSavingRate.toFixed(
            1,
          )}% last month. You're saving more! If invested, your ${monthlySavings.toFixed(0)}zł/month could grow to ${(
            yearlyInvestment * 1.07
          ).toFixed(0)}zł in a year.`;
        } else {
          const targetExpense = currentMonth.income - (currentMonth.income * prevSavingRate) / 100;
          const reductionNeeded = currentMonth.expense - targetExpense;

          messageBody = `📉 Saving rate: ${currentSavingRate.toFixed(1)}% this month vs ${prevSavingRate.toFixed(
            1,
          )}% last month. To match last month, try reducing expenses by ${reductionNeeded.toFixed(0)}zł next month.`;
        }

        const notification = {
          to: user.token,
          sound: 'default',
          title: '💰 Monthly Saving Analysis',
          body: this.truncateNotification(messageBody),
        } as ExpoPushMessage;

        await this.sendSingleNotification(notification);
        await this.notificationService.saveNotification(user.userId, notification);
      } catch (error) {
        this.logger.error(`Error processing saving rate for user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  @Cron('0 7 * * 0', {
    timeZone: 'Europe/Warsaw',
  })
  async weeklyFinancialTip() {
    this.logger.log('Sending weekly financial tip for young adults');
    const users = await this.notificationService.findAll();

    const tips = [
      '🎓 Student discount hack: Use apps like Unidays or Student Beans to find discounts on everything from clothes to tech.',
      '🍕 Food budget tip: Meal prep on Sundays can save you up to 70% compared to eating out or ordering in.',
      '💰 Try the 70/20/10 rule: 70% for living costs, 20% for fun, 10% for future you. Easier than the 50/30/20 rule to start with!',
      '📱 App subscription audit: Delete unused apps that charge monthly - the average person wastes 250zł yearly on forgotten subscriptions.',
      '🎮 Gaming tip: Wait for seasonal sales to buy games or use subscription services like Game Pass instead of buying each title.',
      '💼 Side hustle idea: Turn your social media skills into freelance work - businesses pay well for help with their online presence.',
      '🏠 Housing hack: Splitting rent with one roommate can save you 40-50% on your biggest monthly expense.',
      '✈️ Travel smart: Use student flight discounts and hostels to explore Europe for under 1000zł per trip.',
      '🛍️ Shopping tip: Use browser extensions like Honey to automatically find discount codes at checkout.',
      '☕ The coffee calculator: Making coffee at home vs buying daily can save you over 2000zł per year.',
      '🚗 Transport savings: Compare the real cost of car ownership vs public transport + occasional rideshares.',
      '💻 Tech tip: Buy refurbished electronics with warranties to save 30-50% on phones and laptops.',
      '👕 Clothing hack: Thrift stores and secondhand apps like Vinted offer trendy clothes at 70-90% off retail.',
      '📊 Money challenge: Save 5zł on day 1, 10zł on day 2, and so on for 30 days to easily save 2325zł in a month.',
      '💳 Credit building: Using a credit card for regular expenses and paying it off monthly helps build your credit score.',
      '🎭 Free fun finder: Follow local event pages for free concerts, exhibitions and activities instead of paying for entertainment.',
      '📚 Learning hack: Use free resources like YouTube tutorials and library books before paying for courses.',
      '🏋️ Fitness tip: University gyms, public parks, and free YouTube workouts can replace expensive gym memberships.',
      '💸 Digital banking tip: Use apps like Revolut or N26 for fee-free currency exchange when traveling.',
      '🎧 Entertainment hack: Split premium subscriptions like Spotify Family or Netflix with friends to save up to 70%.',
    ];

    const weekNumber = dayjs().isoWeek();
    const tipIndex = weekNumber % tips.length;
    const tip = tips[tipIndex];

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const notification = {
          to: user.token,
          sound: 'default',
          title: '💡 Smart Money Tip',
          body: tip,
        } as ExpoPushMessage;

        await this.sendSingleNotification(notification);
        await this.notificationService.saveNotification(user.userId, notification);
      } catch (error) {
        this.logger.error(`Error sending financial tip to user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  @Cron('0 7 */3 * *', {
    timeZone: 'Europe/Warsaw',
  })
  async whatIfAnalysis() {
    this.logger.log('Running "What If" analysis');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) continue;

        const startDate = dayjs().subtract(3, 'month').startOf('month').format('YYYY-MM-DD');
        const endDate = dayjs().format('YYYY-MM-DD');

        const categories = await this.expenseService.getCategoryBreakdown(walletId, [startDate, endDate]);

        if (!categories || categories.length < 2) {
          this.logger.log(`Not enough category data for user ${user.userId}`);
          continue;
        }

        const viableCategories = categories.filter((c) => parseFloat(c.total) > 30 && parseFloat(c.count) >= 2);

        if (viableCategories.length === 0) {
          this.logger.log(`No viable categories found for user ${user.userId}`);
          continue;
        }

        const dayOfMonth = dayjs().date();
        const userSeed = user.userId.charCodeAt(0) || 1;
        const combinedSeed = (dayOfMonth + userSeed) % viableCategories.length;

        const targetCategory = viableCategories[combinedSeed];
        const targetSpending = parseFloat(targetCategory.total);
        const monthsInPeriod = dayjs(endDate).diff(dayjs(startDate), 'month', true);
        const monthlyAverage = targetSpending / monthsInPeriod;

        const reductionPercent = 15 + ((dayOfMonth + userSeed) % 4) * 5;
        const monthlySavings = (monthlyAverage * reductionPercent) / 100;
        const yearlySavings = monthlySavings * 12;

        const fiveYearSavings = yearlySavings * 5;
        const tenYearWithGrowth = monthlySavings * 12 * ((Math.pow(1.07, 10) - 1) / 0.07);

        const intros = [
          '💡 Money math magic!',
          '💰 Cash flow forecast:',
          '🔮 Financial future vision:',
          '💸 Savings spotlight:',
          '⚡ Quick money hack:',
          '🧠 Smart money move:',
          '✨ Financial freedom path:',
          '🎯 Budget breakthrough:',
          '📈 Wealth builder tip:',
          '🔍 Spending insight:',
        ];

        const useCases = [
          `That could be a weekend getaway every year!`,
          `Invest that and it's ${Math.round(tenYearWithGrowth)}zł in 10 years!`,
          `That's a new smartphone every year with no budget impact!`,
          `Stash that away and you've got an emergency fund building!`,
          `Put that toward retirement and future you will be thankful!`,
          `That's a monthly subscription to something you'd really enjoy!`,
          `Save that for a year and treat yourself to something amazing!`,
          `That's a nice dinner out every month without affecting your budget!`,
          `In 5 years, that's ${Math.round(fiveYearSavings)}zł for a big life upgrade!`,
          `Small changes, big results - that's how wealth builds!`,
        ];

        const introIndex = (dayOfMonth + userSeed) % intros.length;
        const useCaseIndex = (dayOfMonth + userSeed + 3) % useCases.length;

        const messageBody = `${intros[introIndex]} Cutting ${
          targetCategory.category
        } by ${reductionPercent}% saves ${monthlySavings.toFixed(0)}zł/month or ${yearlySavings.toFixed(0)}zł/year. ${
          useCases[useCaseIndex]
        }`;

        const notification = {
          to: user.token,
          sound: 'default',
          title: '💡 What If? Savings Opportunity',
          body: this.truncateNotification(messageBody),
        } as ExpoPushMessage;

        await this.sendSingleNotification(notification);

        await this.notificationService.saveNotification(user.userId, notification);

        this.logger.log(`Sent What If analysis for category ${targetCategory.category} to user ${user.userId}`);
      } catch (error) {
        this.logger.error(`Error processing what-if analysis for user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  @Cron('0 22 * * 5', {
    timeZone: 'Europe/Warsaw',
  })
  async spontaneousPurchaseAnalysis() {
    this.logger.log('Running spontaneous purchase analysis');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) continue;

        const startDate = dayjs().subtract(1, 'month').format('YYYY-MM-DD');
        const endDate = dayjs().format('YYYY-MM-DD');

        const expenses = await this.expenseService.getExpensesWithSpontaneousRate(walletId, [startDate, endDate]);

        if (!expenses || expenses.length < 5) {
          this.logger.log(`Not enough expenses for user ${user.userId} to analyze spontaneous purchases`);
          continue;
        }

        const spontaneousPurchases = expenses.filter((exp) => exp.spontaneousRate >= 70 && exp.type === 'expense');

        const totalExpenses = expenses.reduce(
          (sum, exp) => (exp.type === 'expense' ? sum + parseFloat(exp.amount) : sum),
          0,
        );

        const totalSpontaneous = spontaneousPurchases.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

        if (spontaneousPurchases.length === 0 || totalSpontaneous < 20) {
          continue;
        }

        const spontaneousPercentage = (totalSpontaneous / totalExpenses) * 100;

        const potentialMonthlySavings = totalSpontaneous * 0.7;
        const potentialYearlySavings = potentialMonthlySavings * 12;

        const categoryMap = {};
        spontaneousPurchases.forEach((purchase) => {
          if (!categoryMap[purchase.category]) {
            categoryMap[purchase.category] = 0;
          }
          categoryMap[purchase.category] += parseFloat(purchase.amount);
        });

        let topCategory = '';
        let topCategoryAmount = 0;
        for (const [category, amount] of Object.entries(categoryMap)) {
          if ((amount as any) > topCategoryAmount) {
            topCategoryAmount = amount as number;
            topCategory = category;
          }
        }

        const totalReduction = (potentialMonthlySavings / totalExpenses) * 100;

        let messageBody = '';

        if (spontaneousPercentage >= 30) {
          messageBody = `🛍️ ${spontaneousPercentage.toFixed(
            0,
          )}% of your spending is spontaneous! Reducing impulse buys could save ${potentialYearlySavings.toFixed(
            0,
          )}zł/year. Most common: ${topCategory}.`;
        } else {
          messageBody = `💭 Impulse purchases in ${topCategory} totaled ${topCategoryAmount.toFixed(
            2,
          )}zł last month. Cutting back could save ${potentialYearlySavings.toFixed(0)}zł/year.`;
        }

        if (totalReduction >= 15) {
          messageBody += ` That's a ${totalReduction.toFixed(0)}% reduction in monthly expenses!`;
        }

        const notification = {
          to: user.token,
          sound: 'default',
          title: '💡 Spontaneous Spending Insight',
          body: this.truncateNotification(messageBody),
        } as ExpoPushMessage;

        await this.sendSingleNotification(notification);

        await this.notificationService.saveNotification(user.userId, notification);
      } catch (error) {
        this.logger.error(
          `Error processing spontaneous purchase analysis for user ${user.userId}: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  @Cron('0 7 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async zeroSpendDayChallenge() {
    this.logger.log('Running zero spend day challenge');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) continue;

        const today = dayjs().format('YYYY-MM-DD');
        const subscriptionsDueToday = await this.subscriptionSerivce.getSubscriptionsDueOn(walletId, today);

        if (subscriptionsDueToday.length > 0) continue;

        const lastFiveDays = [];
        for (let i = 1; i <= 5; i++) {
          const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
          const dayExpenses = await this.expenseService.getDailyTotal(walletId, date);
          lastFiveDays.push({ date, total: dayExpenses });
        }

        let consecutiveSpendingDays = 0;
        for (const day of lastFiveDays) {
          if (day.total > 0) {
            consecutiveSpendingDays++;
          } else {
            break;
          }
        }

        if (consecutiveSpendingDays >= 3) {
          const avgDailySpend =
            lastFiveDays.slice(0, consecutiveSpendingDays).reduce((sum, day) => sum + day.total, 0) /
            consecutiveSpendingDays;

          const notification = {
            to: user.token,
            sound: 'default',
            title: '💰 Zero Spend Challenge',
            body: `You've spent money ${consecutiveSpendingDays} days in a row. Take the zero-spend challenge today to save ~${avgDailySpend.toFixed(
              0,
            )}zł! Small breaks add up to big savings.`,
            data: {
              type: 'zeroSpendChallenge',
              avgAmount: avgDailySpend,
            },
          } as ExpoPushMessage;

          await this.notificationService.sendChunkNotifications([notification]);

          await this.notificationService.saveNotification(user.userId, notification);
        }
      } catch (error) {
        this.logger.error(`Error processing zero spend challenge for user ${user.userId}: ${error.message}`);
      }
    }
  }

  @Cron('0 22 * * 5', {
    timeZone: 'Europe/Warsaw',
  })
  async roundUpSavingsOpportunity() {
    this.logger.log('Running round-up savings opportunity');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        let walletId = null;
        try {
          walletId = await this.walletService.getWalletId(user.userId);
          this.logger.debug(`Retrieved walletId: ${walletId} for userId: ${user.userId}`);

          if (!walletId) {
            this.logger.warn(`No wallet found for user ${user.userId}`);
            continue;
          }
        } catch (error) {
          this.logger.error(`Error getting walletId: ${error.message}`);
          continue;
        }

        const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
        const today = dayjs().format('YYYY-MM-DD');

        let transactions = [];
        try {
          const result = await this.expenseService.getRoundUp(user.userId, { from: weekStart, to: today });

          if (Array.isArray(result)) {
            transactions = result;
          } else if (result && typeof result === 'object' && Array.isArray(result)) {
            transactions = result;
          } else {
            this.logger.warn(`Unexpected transactions result format for user ${user.userId}`);
            transactions = [];
          }

          this.logger.debug(`Retrieved ${transactions.length} transactions for user ${user.userId}`);
        } catch (error) {
          this.logger.error(`Error retrieving transactions: ${error.message}`);
          transactions = [];
        }

        let roundUpTotal = 0;
        let transactionCount = 0;

        for (const transaction of transactions) {
          if (transaction.type !== 'expense') continue;

          const amount =
            typeof transaction.amount === 'string' ? parseFloat(transaction.amount) : Number(transaction.amount);

          if (isNaN(amount) || amount <= 0) continue;

          const roundUpAmount = Math.ceil(amount) - amount;

          if (roundUpAmount > 0) {
            roundUpTotal += roundUpAmount;
            transactionCount++;
          }
        }

        if (roundUpTotal >= 5 && transactionCount >= 3) {
          const annualSavings = roundUpTotal * 52;

          const notification = {
            to: user.token,
            sound: 'default',
            title: '💰 Round-Up Savings Opportunity',
            body: `By rounding up your ${transactionCount} transactions this week, you could have saved ${roundUpTotal.toFixed(
              2,
            )}zł. That's ${annualSavings.toFixed(0)}zł per year! Enable automatic round-up savings?`,
            data: {
              type: 'roundUpSavings',
              weeklyAmount: roundUpTotal,
              transactionCount: transactionCount,
            },
          } as ExpoPushMessage;

          try {
            await this.notificationService.sendChunkNotifications([notification]);

            this.notificationService.saveNotification(user.userId, notification);

            this.logger.log(`Sent round-up opportunity notification to user ${user.userId}`);
          } catch (error) {
            this.logger.error(`Error sending notification: ${error.message}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error processing round-up opportunity for user ${user.userId}: ${error.message}`);
      }
    }
  }
}

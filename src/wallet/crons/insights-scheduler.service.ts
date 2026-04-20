import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as dayjs from 'dayjs';
import { ExpoPushMessage } from 'expo-server-sdk';
import { NotificationsService } from 'src/notifications/notifications.service';
import { formatCategory } from 'src/utils/fns/format-category';
import { ExpenseService } from '../services/expense.service';
import { SubscriptionService } from '../services/subscriptions.service';
import { WalletService } from '../services/wallet.service';
import { BaseScheduler } from '../../notifications/scheduler-base.service';

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
    this.forEachNotification('dailyInsights', async (user) => {
      try {
        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) return null;

        const wallet = await this.walletService.getWallet(walletId);

        const [today, yesterday] = await Promise.all([
          this.expenseService.getDailyInsights(walletId, [
            dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
            dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss'),
          ]),
          this.expenseService.getDailyInsights(walletId, [
            dayjs().startOf('day').subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
            dayjs().endOf('day').subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
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

        return {
          to: user.token,
          sound: 'default',
          title: '📱 Daily Finance Update',
          body: messageBody,
        } as ExpoPushMessage;
      } catch (error) {
        console.error(`Error processing insights for user ${user.userId}:`, error);
        return null;
      }
    });
  }

  // @Cron('0 22 * * 1', {
  //   timeZone: 'Europe/Warsaw',
  // })
  // async spendingPatternInsights() {
  //   const notifications = await this.notificationService.findAll();

  //   for (const n of notifications) {
  //     try {
  //       if (n.isEnable === false || !n.token) continue;

  //       const walletId = await this.walletService.getWalletId(n.userId);
  //       if (!walletId) continue;

  //       const startDate = dayjs().subtract(1, 'month').format('YYYY-MM-DD');
  //       const endDate = dayjs().format('YYYY-MM-DD');

  //       const hourlyData = await this.expenseService.getHourlySpendingPatterns(walletId, [startDate, endDate]);

  //       if (!hourlyData || hourlyData.length === 0) continue;

  //       let maxHour = -1;
  //       let maxAvgAmount = 0;

  //       for (const hour of hourlyData) {
  //         if (hour.count >= 5 && hour.avg_amount > maxAvgAmount) {
  //           maxHour = hour.hour;
  //           maxAvgAmount = hour.avg_amount;
  //         }
  //       }

  //       if (maxHour === -1) continue;

  //       const topCategory = await this.expenseService.getTopCategoryForHour(walletId, maxHour, [startDate, endDate]);

  //       const hour12 = maxHour % 12 || 12;
  //       const ampm = maxHour >= 12 ? 'PM' : 'AM';
  //       const timeStr = `${hour12}${ampm}`;

  //       const messageBody = `⏰ You tend to make more purchases around ${timeStr}, spending an average of ${maxAvgAmount.toFixed(
  //         2,
  //       )}zł${topCategory ? `. Most common category: ${formatCategory(topCategory)}` : ''}.`;

  //       const truncatedBody = messageBody.length > 178 ? messageBody.substring(0, 175) + '...' : messageBody;

  //       const notification = {
  //         to: n.token,
  //         sound: 'default',
  //         title: '🔍 Spending Pattern Detected',
  //         body: truncatedBody,
  //       } as ExpoPushMessage;

  //       await this.notificationService.sendChunkNotifications([notification]);
  //       await this.notificationService.saveNotification(n.userId, notification);
  //     } catch (error) {
  //       console.error(`Error processing spending patterns for user ${n.userId}:`, error);
  //     }
  //   }
  // }

  @Cron('0 22 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async unusualSpendingAlert() {
    this.forEachNotification('unusualSpending', async (user) => {
      try {
        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) return null;

        const todayData = await this.expenseService.getDailyInsights(walletId, [
          dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
          dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss'),
        ]);

        const todayExpense = todayData.expense_sum || 0;

        if (todayExpense <= 0) return null;

        const lastMonthStart = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
        const yesterdayEnd = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

        const monthlyData = await this.expenseService.getTotalExpensesForPeriod(walletId, [
          dayjs(lastMonthStart).startOf('day').format('YYYY-MM-DD HH:mm:ss'),
          dayjs(yesterdayEnd).endOf('day').format('YYYY-MM-DD HH:mm:ss'),
        ]);

        const monthlyTotal = monthlyData.expense_sum || 0;
        const daysInPeriod = dayjs(yesterdayEnd).diff(dayjs(lastMonthStart), 'day') + 1;
        const averageDaily = monthlyTotal / Math.max(1, daysInPeriod);

        if (todayExpense > averageDaily * 2 && todayExpense >= 20) {
          const ratio = todayExpense / averageDaily;

          const messageBody = `📈 ${todayExpense.toFixed(2)}zł spent today is ${ratio.toFixed(
            1,
          )}x your daily average of ${averageDaily.toFixed(2)}zł!`;

          return {
            to: user.token,
            sound: 'default',
            title: '⚠️ Unusual Spending Detected',
            body: messageBody,
          } as ExpoPushMessage;
        }

        return null;
      } catch (error) {
        console.error(`Error processing unusual spending alert for user ${user.userId}:`, error);
        return null;
      }
    });
  }

  @Cron('0 22 * * 6', {
    timeZone: 'Europe/Warsaw',
  })
  async weekdayVsWeekendAnalysis() {
    this.logger.log('Running weekday vs weekend analysis');

    this.forEachNotification('weekdayWeekendAnalysis', async (user) => {
      try {
        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) return null;

        const startDate = dayjs().subtract(28, 'day').format('YYYY-MM-DD');
        const endDate = dayjs().format('YYYY-MM-DD');

        const expenses = await this.expenseService.getExpensesForPeriod(walletId, [
          dayjs(startDate).startOf('day').format('YYYY-MM-DD HH:mm:ss'),
          dayjs(endDate).endOf('day').format('YYYY-MM-DD HH:mm:ss'),
        ]);

        if (!expenses || expenses.length < 10) {
          this.logger.log(`Not enough expenses for user ${user.userId} to analyze weekend patterns`);
          return null;
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
          return null;
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

          return {
            to: user.token,
            sound: 'default',
            title: '💰 Spending Pattern Analysis',
            body: this.truncateNotification(messageBody),
          } as ExpoPushMessage;
        }

        return null;
      } catch (error) {
        this.logger.error(`Error processing weekend analysis for user ${user.userId}: ${error.message}`, error.stack);
        return null;
      }
    });
  }

  // @Cron('0 22 * * 0', {
  //   timeZone: 'Europe/Warsaw',
  // }) disable
  async topSpendingDayAnalysis() {
    this.logger.log('Running top spending day analysis');

    this.forEachNotification('topSpendingDay', async (user) => {
      try {
        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) return null;

        const startDate = dayjs().subtract(6, 'week').format('YYYY-MM-DD');
        const endDate = dayjs().format('YYYY-MM-DD');

        const dayOfWeekData = await this.expenseService.getSpendingByDayOfWeek(walletId, [startDate, endDate]);

        if (!dayOfWeekData || dayOfWeekData.length === 0) {
          return null;
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
          return null;
        }

        const percentDiff = ((highestAvg - lowestAvg) / lowestAvg) * 100;

        if (percentDiff >= 25) {
          const weeklySavingsPotential = highestAvg - lowestAvg;
          const annualSavings = weeklySavingsPotential * 52;

          const messageBody = `📊 Your top spending day is ${dayNames[highestAvgDay]}. Tip: Plan purchases for ${
            dayNames[lowestAvgDay]
          } when you spend ${percentDiff.toFixed(0)}% less. Potential yearly savings: ${annualSavings.toFixed(0)}zł.`;

          return {
            to: user.token,
            sound: 'default',
            title: '💸 Spending Day Insight',
            body: this.truncateNotification(messageBody),
          } as ExpoPushMessage;
        }

        return null;
      } catch (error) {
        this.logger.error(`Error processing top spending day for user ${user.userId}: ${error.message}`, error.stack);
        return null;
      }
    });
  }

  @Cron('0 22 26 * *', {
    timeZone: 'Europe/Warsaw',
  })
  async monthlyCategoryComparison() {
    this.logger.log('Running monthly category comparison');

    this.forEachNotification('monthlyCategoryComparison', async (user) => {
      try {
        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) return null;

        const currentMonth = dayjs().format('YYYY-MM');
        const lastMonth = dayjs().subtract(1, 'month').format('YYYY-MM');

        const monthlyData = await this.expenseService.getMonthlyCategories(walletId, [lastMonth, currentMonth]);

        if (!monthlyData || monthlyData.length !== 2) {
          return null;
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
          } but ${biggestIncrease.change.toFixed(2)}zł more on ${formatCategory(biggestIncrease.category)}. Yearly impact: ${
            yearlyImpact > 0 ? '+' : ''
          }${yearlyImpact.toFixed(0)}zł.`;
        } else if (biggestDecrease.category) {
          const yearlySavings = biggestDecrease.change * 12;

          messageBody = `📉 Great job! You've spent ${biggestDecrease.change.toFixed(2)}zł less on ${formatCategory(
            biggestDecrease.category,
          )} this month. If continued, that's ${yearlySavings.toFixed(0)}zł saved yearly!`;
        } else if (biggestIncrease.category) {
          const yearlyCost = biggestIncrease.change * 12;

          messageBody = `📈 Spending alert: ${biggestIncrease.change.toFixed(2)}zł increase on ${formatCategory(
            biggestIncrease.category,
          )} this month. If this continues, it adds ${yearlyCost.toFixed(0)}zł yearly to your expenses.`;
        }

        if (messageBody) {
          return {
            to: user.token,
            sound: 'default',
            title: '📆 Monthly Category Report',
            body: this.truncateNotification(messageBody),
          } as ExpoPushMessage;
        }

        return null;
      } catch (error) {
        this.logger.error(`Error processing monthly comparison for user ${user.userId}: ${error.message}`, error.stack);
        return null;
      }
    });
  }

  @Cron('0 22 28-31 * *', {
    timeZone: 'Europe/Warsaw',
  })
  async savingRateAnalysis() {
    if (!dayjs().isSame(dayjs().endOf('month'), 'day')) {
      return;
    }

    this.logger.log('Running saving rate analysis');

    this.forEachNotification('savingRateAnalysis', async (user) => {
      try {
        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) return null;

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
          return null;
        }

        const currentSavingRate =
          currentMonth.income > 0 ? ((currentMonth.income - currentMonth.expense) / currentMonth.income) * 100 : 0;

        const prevSavingRate =
          prevMonth.income > 0 ? ((prevMonth.income - prevMonth.expense) / prevMonth.income) * 100 : 0;

        if (currentMonth.income <= 0 || prevMonth.income <= 0) {
          return null;
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

        return {
          to: user.token,
          sound: 'default',
          title: '💰 Monthly Saving Analysis',
          body: this.truncateNotification(messageBody),
        } as ExpoPushMessage;
      } catch (error) {
        this.logger.error(`Error processing saving rate for user ${user.userId}: ${error.message}`, error.stack);
        return null;
      }
    });
  }

  @Cron('0 7 */3 * *', {
    timeZone: 'Europe/Warsaw',
  })
  async whatIfAnalysis() {
    this.logger.log('Running "What If" analysis');

    this.forEachNotification('whatIfAnalysis', async (user) => {
      try {
        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) return null;

        const startDate = dayjs().subtract(3, 'month').startOf('month').format('YYYY-MM-DD');
        const endDate = dayjs().format('YYYY-MM-DD');

        const categories = await this.expenseService.getCategoryBreakdown(walletId, [startDate, endDate]);

        if (!categories || categories.length < 2) {
          this.logger.log(`Not enough category data for user ${user.userId}`);
          return null;
        }

        const viableCategories = categories.filter((c) => parseFloat(c.total) > 30 && parseFloat(c.count) >= 2);

        if (viableCategories.length === 0) {
          this.logger.log(`No viable categories found for user ${user.userId}`);
          return null;
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

        this.logger.log(
          `Sent What If analysis for category ${formatCategory(targetCategory.category)} to user ${user.userId}`,
        );

        return {
          to: user.token,
          sound: 'default',
          title: '💡 What If? Savings Opportunity',
          body: this.truncateNotification(messageBody),
        } as ExpoPushMessage;
      } catch (error) {
        this.logger.error(`Error processing what-if analysis for user ${user.userId}: ${error.message}`, error.stack);
        return null;
      }
    });
  }

  @Cron('0 22 * * 5', {
    timeZone: 'Europe/Warsaw',
  })
  async spontaneousPurchaseAnalysis() {
    this.logger.log('Running spontaneous purchase analysis');

    this.forEachNotification('spontaneousPurchase', async (user) => {
      try {
        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) return null;

        const startDate = dayjs().subtract(1, 'month').format('YYYY-MM-DD');
        const endDate = dayjs().format('YYYY-MM-DD');

        const expenses = await this.expenseService.getExpensesWithSpontaneousRate(walletId, [startDate, endDate]);

        if (!expenses || expenses.length < 5) {
          this.logger.log(`Not enough expenses for user ${user.userId} to analyze spontaneous purchases`);
          return null;
        }

        const spontaneousPurchases = expenses.filter((exp) => exp.spontaneousRate >= 70 && exp.type === 'expense');

        const totalExpenses = expenses.reduce(
          (sum, exp) => (exp.type === 'expense' ? sum + parseFloat(exp.amount) : sum),
          0,
        );

        const totalSpontaneous = spontaneousPurchases.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

        if (spontaneousPurchases.length === 0 || totalSpontaneous < 20) {
          return null;
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
          )}zł/year. Most common: ${formatCategory(topCategory)}.`;
        } else {
          messageBody = `💭 Impulse purchases in ${formatCategory(topCategory)} totaled ${topCategoryAmount.toFixed(
            2,
          )}zł last month. Cutting back could save ${potentialYearlySavings.toFixed(0)}zł/year.`;
        }

        if (totalReduction >= 15) {
          messageBody += ` That's a ${totalReduction.toFixed(0)}% reduction in monthly expenses!`;
        }

        return {
          to: user.token,
          sound: 'default',
          title: '💡 Spontaneous Spending Insight',
          body: this.truncateNotification(messageBody),
        } as ExpoPushMessage;
      } catch (error) {
        this.logger.error(
          `Error processing spontaneous purchase analysis for user ${user.userId}: ${error.message}`,
          error.stack,
        );
        return null;
      }
    });
  }

  @Cron('0 7 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async zeroSpendDayChallenge() {
    this.logger.log('Running zero spend day challenge');

    this.forEachNotification('zeroSpendChallenge', async (user) => {
      try {
        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) return null;

        const today = dayjs().format('YYYY-MM-DD');
        const subscriptionsDueToday = await this.subscriptionSerivce.getSubscriptionsDueOn(walletId, today);

        if (subscriptionsDueToday.length > 0) return null;

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

          return {
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
        }

        return null;
      } catch (error) {
        this.logger.error(`Error processing zero spend challenge for user ${user.userId}: ${error.message}`);
        return null;
      }
    });
  }

  @Cron('0 22 * * 5', {
    timeZone: 'Europe/Warsaw',
  })
  async roundUpSavingsOpportunity() {
    this.logger.log('Running round-up savings opportunity');

    this.forEachNotification('roundUpSavings', async (user) => {
      try {
        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) return null;

        const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
        const today = dayjs().format('YYYY-MM-DD');

        let transactions = [];
        try {
          const result = await this.expenseService.getRoundUp(user.userId, { from: weekStart, to: today });

          if (Array.isArray(result)) {
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

          this.logger.log(`Sent round-up opportunity notification to user ${user.userId}`);

          return {
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
        }

        return null;
      } catch (error) {
        this.logger.error(`Error processing round-up opportunity for user ${user.userId}: ${error.message}`);
        return null;
      }
    });
  }
}

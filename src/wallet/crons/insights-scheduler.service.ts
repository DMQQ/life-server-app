import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WalletService } from '../wallet.service';
import { ExpenseService } from '../expense.service';
import { ExpoPushMessage } from 'expo-server-sdk';
import { ExpenseType, LimitRange } from '../wallet.entity';
import * as moment from 'moment';
import { LimitsService } from '../limits.service';

@Injectable()
export class InsightsSchedulerService {
  private readonly logger = new Logger(InsightsSchedulerService.name);

  constructor(
    private notificationService: NotificationsService,
    private walletService: WalletService,
    private expenseService: ExpenseService,

    private limitsService: LimitsService,
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
          )}x your daily average of ${averageDaily.toFixed(2)}zł!`;

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

  @Cron('0 9 * * 6', {
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

        // Get data for last 4 weeks
        const startDate = moment().subtract(28, 'days').format('YYYY-MM-DD');
        const endDate = moment().format('YYYY-MM-DD');

        // Get all expenses
        const expenses = await this.expenseService.getExpensesForPeriod(walletId, [
          moment(startDate).startOf('day').format('YYYY-MM-DD HH:MM:ss'),
          moment(endDate).endOf('day').format('YYYY-MM-DD HH:MM:ss'),
        ]);

        // Skip if not enough data
        if (!expenses || expenses.length < 10) {
          this.logger.log(`Not enough expenses for user ${user.userId} to analyze weekend patterns`);
          continue;
        }

        // Split expenses by weekday and weekend
        const weekdayExpenses = [];
        const weekendExpenses = [];

        for (const expense of expenses) {
          const date = moment(expense.date);
          const dayOfWeek = date.day();

          // 0 is Sunday, 6 is Saturday
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            weekendExpenses.push(expense);
          } else {
            weekdayExpenses.push(expense);
          }
        }

        // Skip if not enough data in either category
        if (weekdayExpenses.length < 5 || weekendExpenses.length < 3) {
          continue;
        }

        const weekdayTotal = weekdayExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
        const weekendTotal = weekendExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

        const totalDays = moment(endDate).diff(moment(startDate), 'days') + 1;
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

          await this.sendSingleNotification({
            to: user.token,
            sound: 'default',
            title: '💰 Spending Pattern Analysis',
            body: this.truncateNotification(messageBody),
          });
        }
      } catch (error) {
        this.logger.error(`Error processing weekend analysis for user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  @Cron('0 10 * * 0', {
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

        const startDate = moment().subtract(6, 'weeks').format('YYYY-MM-DD');
        const endDate = moment().format('YYYY-MM-DD');

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

          // Create message
          const messageBody = `📊 Your top spending day is ${dayNames[highestAvgDay]}. Tip: Plan purchases for ${
            dayNames[lowestAvgDay]
          } when you spend ${percentDiff.toFixed(0)}% less. Potential yearly savings: ${annualSavings.toFixed(0)}zł.`;

          await this.sendSingleNotification({
            to: user.token,
            sound: 'default',
            title: '💸 Spending Day Insight',
            body: this.truncateNotification(messageBody),
          });
        }
      } catch (error) {
        this.logger.error(`Error processing top spending day for user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  @Cron('0 12 26 * *', {
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

        const currentMonth = moment().format('YYYY-MM');
        const lastMonth = moment().subtract(1, 'month').format('YYYY-MM');

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
          await this.sendSingleNotification({
            to: user.token,
            sound: 'default',
            title: '📆 Monthly Category Report',
            body: this.truncateNotification(messageBody),
          });
        }
      } catch (error) {
        this.logger.error(`Error processing monthly comparison for user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  @Cron('0 18 28-31 * *', {
    timeZone: 'Europe/Warsaw',
  })
  async savingRateAnalysis() {
    if (!moment().isSame(moment().endOf('month'), 'day')) {
      return;
    }

    this.logger.log('Running saving rate analysis');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) continue;

        const currentMonthStart = moment().startOf('month').format('YYYY-MM-DD');
        const currentMonthEnd = moment().endOf('month').format('YYYY-MM-DD');
        const prevMonthStart = moment().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        const prevMonthEnd = moment().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');

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

        await this.sendSingleNotification({
          to: user.token,
          sound: 'default',
          title: '💰 Monthly Saving Analysis',
          body: this.truncateNotification(messageBody),
        });
      } catch (error) {
        this.logger.error(`Error processing saving rate for user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  @Cron('0 17 * * 0', {
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

    const weekNumber = moment().week();
    const tipIndex = weekNumber % tips.length;
    const tip = tips[tipIndex];

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        await this.sendSingleNotification({
          to: user.token,
          sound: 'default',
          title: '💡 Smart Money Tip',
          body: tip,
        });
      } catch (error) {
        this.logger.error(`Error sending financial tip to user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  @Cron('0 19 */3 * *', {
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

        const startDate = moment().subtract(3, 'months').startOf('month').format('YYYY-MM-DD');
        const endDate = moment().format('YYYY-MM-DD');

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

        const dayOfMonth = moment().date();
        const userSeed = user.userId.charCodeAt(0) || 1;
        const combinedSeed = (dayOfMonth + userSeed) % viableCategories.length;

        const targetCategory = viableCategories[combinedSeed];
        const targetSpending = parseFloat(targetCategory.total);
        const monthsInPeriod = moment(endDate).diff(moment(startDate), 'months', true);
        const monthlyAverage = targetSpending / monthsInPeriod;

        const reductionPercent = 15 + ((dayOfMonth + userSeed) % 4) * 5;
        const monthlySavings = (monthlyAverage * reductionPercent) / 100;
        const yearlySavings = monthlySavings * 12;

        // Calculate long-term impact
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
          `Invest that and it's $${Math.round(tenYearWithGrowth)} in 10 years!`,
          `That's a new smartphone every year with no budget impact!`,
          `Stash that away and you've got an emergency fund building!`,
          `Put that toward retirement and future you will be thankful!`,
          `That's a monthly subscription to something you'd really enjoy!`,
          `Save that for a year and treat yourself to something amazing!`,
          `That's a nice dinner out every month without affecting your budget!`,
          `In 5 years, that's $${Math.round(fiveYearSavings)} for a big life upgrade!`,
          `Small changes, big results - that's how wealth builds!`,
        ];

        const introIndex = (dayOfMonth + userSeed) % intros.length;
        const useCaseIndex = (dayOfMonth + userSeed + 3) % useCases.length;

        const messageBody = `${intros[introIndex]} Cutting ${
          targetCategory.category
        } by ${reductionPercent}% saves $${monthlySavings.toFixed(0)}/month or $${yearlySavings.toFixed(0)}/year. ${
          useCases[useCaseIndex]
        }`;

        await this.sendSingleNotification({
          to: user.token,
          sound: 'default',
          title: '💡 What If? Savings Opportunity',
          body: this.truncateNotification(messageBody),
        });

        this.logger.log(`Sent What If analysis for category ${targetCategory.category} to user ${user.userId}`);
      } catch (error) {
        this.logger.error(`Error processing what-if analysis for user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  @Cron('0 8 * * *', {
    timeZone: 'Europe/Warsaw',
  })
  async moneyLeftToday() {
    this.logger.log('Running Money Left Today notifications');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        const walletId = await this.walletService.getWalletId(user.userId);
        if (!walletId) continue;

        const wallet = await this.walletService.getWallet(walletId);
        if (!wallet) continue;

        const today = moment().format('YYYY-MM-DD');

        const daysLeftInMonth = moment().endOf('month').diff(moment(), 'days');
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

        const weeklyBudget = monthlyBudget / 4.3;

        const daysInMonth = moment().daysInMonth();
        const dailyBudget = monthlyBudget / daysInMonth;

        const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
        const monthToDate = await this.expenseService.getTotalExpensesForPeriod(walletId, [startOfMonth, today]);
        const spentThisMonth = monthToDate.expense_sum || 0;

        const startOfWeek = moment().startOf('week').format('YYYY-MM-DD');
        const weekToDate = await this.expenseService.getTotalExpensesForPeriod(walletId, [startOfWeek, today]);
        const spentThisWeek = weekToDate.expense_sum || 0;

        const todayExpenses = await this.expenseService.getTotalExpensesForPeriod(walletId, [today, today]);
        const spentToday = todayExpenses.expense_sum || 0;

        const remainingMonthlyBudget = Math.max(0, monthlyBudget - spentThisMonth);
        const remainingWeeklyBudget = Math.max(0, weeklyBudget - spentThisWeek);
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
            )}zł today. Weekly: $${remainingWeeklyBudget.toFixed(2)}, Monthly: ${remainingMonthlyBudget.toFixed(
              2,
            )}zł remaining.`;
          } else {
            messageBody = `💰 You can spend $${canSpendToday.toFixed(
              2,
            )} today to stay on ${constraint} budget. Weekly: ${remainingWeeklyBudget.toFixed(
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

  private async sendSingleNotification(notification: ExpoPushMessage) {
    try {
      if (!notification || !notification.to) {
        return;
      }

      await this.notificationService.sendChunkNotifications([notification]);
      this.logger.log(`Successfully sent notification to ${notification.to.toString().substring(0, 10)}...`);
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
    }
  }

  @Cron('0 18 * * 5', {
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

        const startDate = moment().subtract(1, 'month').format('YYYY-MM-DD');
        const endDate = moment().format('YYYY-MM-DD');

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
          )}% of your spending is spontaneous! Reducing impulse buys could save $${potentialYearlySavings.toFixed(
            0,
          )}/year. Most common: ${topCategory}.`;
        } else {
          messageBody = `💭 Impulse purchases in ${topCategory} totaled $${topCategoryAmount.toFixed(
            2,
          )} last month. Cutting back could save $${potentialYearlySavings.toFixed(0)}/year.`;
        }

        if (totalReduction >= 15) {
          messageBody += ` That's a ${totalReduction.toFixed(0)}% reduction in monthly expenses!`;
        }

        await this.sendSingleNotification({
          to: user.token,
          sound: 'default',
          title: '💡 Spontaneous Spending Insight',
          body: this.truncateNotification(messageBody),
        });
      } catch (error) {
        this.logger.error(
          `Error processing spontaneous purchase analysis for user ${user.userId}: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  private truncateNotification(body: string): string {
    const MAX_LENGTH = 178;
    return body.length > MAX_LENGTH ? body.substring(0, MAX_LENGTH - 3) + '...' : body;
  }
}

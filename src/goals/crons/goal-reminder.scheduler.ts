import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as dayjs from 'dayjs';
import { NotificationsService } from 'src/notifications/notifications.service';
import { BaseScheduler } from 'src/wallet/crons/scheduler-base.service';
import { GoalService } from '../goals.service';

@Injectable()
export class GoalReminderScheduler extends BaseScheduler {
  constructor(
    notificationService: NotificationsService,
    private goalService: GoalService,
  ) {
    super(notificationService);
  }

  // Morning motivation (8 AM)
  // @Cron('0 8 * * *', { timeZone: 'Europe/Warsaw' })
  async sendMorningMotivation() {
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (user.isEnable === false || !user.token) continue;

        const categories = await this.goalService.getUserCategories(user.userId);
        if (categories.length === 0) continue;

        const message = `Good morning! You have ${categories.length} goals to work on today 🎯`;

        const notification = {
          to: user.token,
          title: 'Daily Goals',
          body: message,
          data: { type: 'morning_motivation' },
        };

        await this.sendSingleNotification(notification, user.userId);
      } catch (error) {
        this.logger.error(`Error sending morning motivation to user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  // Midday check-in (12 PM)
  @Cron('0 12 * * *', { timeZone: 'Europe/Warsaw' })
  async sendMiddayCheckIn() {
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (user.isEnable === false || !user.token) continue;

        const reminders = await this.goalService.getGoalReminders(user.userId);
        const completed = reminders.filter((g) => g.isCompleted).length;
        const total = reminders.length;

        if (total === 0) continue;

        const message =
          completed === 0
            ? "Haven't started your goals yet? There's still time! 💪"
            : `Great job! ${completed}/${total} goals completed. Keep going! 🔥`;

        const notification = {
          to: user.token,
          title: 'Midday Check-in',
          body: message,
          data: { type: 'midday_checkin', completed, total },
        };

        await this.sendSingleNotification(notification, user.userId);
      } catch (error) {
        this.logger.error(`Error sending midday check-in to user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  // Weekly summary (Sunday 6 PM)
  @Cron('0 18 * * 0', { timeZone: 'Europe/Warsaw' })
  async sendWeeklySummary() {
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (user.isEnable === false || !user.token) continue;

        const weeklyStats = await this.goalService.getWeeklyStats(user.userId);
        if (!weeklyStats) continue;

        const { completedDays, totalDays } = weeklyStats;
        const percentage = Math.round((completedDays / totalDays) * 100);

        const notification = {
          to: user.token,
          title: 'Weekly Summary',
          body: `This week: ${percentage}% goal completion rate 📊`,
          data: { type: 'weekly_summary', completedDays, totalDays },
        };

        await this.sendSingleNotification(notification, user.userId);
      } catch (error) {
        this.logger.error(`Error sending weekly summary to user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  // Streak warning (when about to break streak)
  @Cron('0 22 * * *', { timeZone: 'Europe/Warsaw' })
  async sendStreakWarning() {
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (user.isEnable === false || !user.token) continue;

        const streaks = await this.goalService.getUserStreaks(user.userId);
        const endangered = streaks.filter((s) => s.days >= 3 && !s.completedToday);

        if (endangered.length === 0) continue;

        const longestStreak = Math.max(...endangered.map((s) => s.days));

        const notification = {
          to: user.token,
          title: 'Streak Alert! ⚠️',
          body: `Don't break your ${longestStreak}-day streak! 2 hours left.`,
          data: { type: 'streak_warning', endangeredStreaks: endangered },
        };

        await this.sendSingleNotification(notification, user.userId);
      } catch (error) {
        this.logger.error(`Error sending streak warning to user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  // Inactivity reminder (if no entries for 2+ days)
  @Cron('0 10 * * *', { timeZone: 'Europe/Warsaw' })
  async sendInactivityReminder() {
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (user.isEnable === false || !user.token) continue;

        const lastActivity = await this.goalService.getLastActivityDate(user.userId);
        const daysSinceActivity = dayjs().diff(lastActivity, 'day');

        if (daysSinceActivity >= 2) {
          const notification = {
            to: user.token,
            title: 'We miss you! 👋',
            body: `It's been ${daysSinceActivity} days. Ready to get back on track?`,
            data: { type: 'inactivity_reminder', daysSinceActivity },
          };

          await this.sendSingleNotification(notification, user.userId);
        }
      } catch (error) {
        this.logger.error(`Error sending inactivity reminder to user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }
}

import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as dayjs from 'dayjs';
import { NotificationsService } from 'src/notifications/notifications.service';
import { BaseScheduler } from 'src/notifications/scheduler-base.service';
import { GoalService } from '../goals.service';

@Injectable()
export class GoalReminderScheduler extends BaseScheduler {
  constructor(
    notificationService: NotificationsService,
    private goalService: GoalService,
  ) {
    super(notificationService);
  }

  @Cron('0 8 * * *', { timeZone: 'Europe/Warsaw' })
  async sendMorningMotivation() {
    await this.forEachNotification('morning_motivation', async (user) => {
      if (!user.token) return null;

      const categories = await this.goalService.getUserCategories(user.userId);
      if (categories.length === 0) return null;

      const message = `Good morning! You have ${categories.length} goals to work on today 🎯`;

      return {
        to: user.token,
        title: 'Daily Goals',
        body: message,
        data: { type: 'morning_motivation' },
      };
    });
  }

  @Cron('0 12 * * *', { timeZone: 'Europe/Warsaw' })
  async sendMiddayCheckIn() {
    await this.forEachNotification('midday_checkin', async (user) => {
      if (!user.token) return null;

      const reminders = await this.goalService.getGoalReminders(user.userId);
      const completed = reminders.filter((g) => g.isCompleted).length;
      const total = reminders.length;

      if (total === 0) return null;

      const message =
        completed === 0
          ? "Haven't started your goals yet? There's still time! 💪"
          : `Great job! ${completed}/${total} goals completed. Keep going! 🔥`;

      return {
        to: user.token,
        title: 'Midday Check-in',
        body: message,
        data: { type: 'midday_checkin', completed, total },
      };
    });
  }

  @Cron('0 18 * * 0', { timeZone: 'Europe/Warsaw' })
  async sendWeeklySummary() {
    await this.forEachNotification('weekly_summary', async (user) => {
      if (!user.token) return null;

      const weeklyStats = await this.goalService.getWeeklyStats(user.userId);
      if (!weeklyStats) return null;

      const { completedDays, totalDays } = weeklyStats;
      const percentage = Math.round((completedDays / totalDays) * 100);

      return {
        to: user.token,
        title: 'Weekly Summary',
        body: `This week: ${percentage}% goal completion rate 📊`,
        data: { type: 'weekly_summary', completedDays, totalDays },
      };
    });
  }

  @Cron('0 22 * * *', { timeZone: 'Europe/Warsaw' })
  async sendStreakWarning() {
    await this.forEachNotification('streak_warning', async (user) => {
      if (!user.token) return null;

      const streaks = await this.goalService.getUserStreaks(user.userId);
      const endangered = streaks.filter((s) => s.days >= 3 && !s.completedToday);

      if (endangered.length === 0) return null;

      const longestStreak = Math.max(...endangered.map((s) => s.days));

      return {
        to: user.token,
        title: 'Streak Alert! ⚠️',
        body: `Don't break your ${longestStreak}-day streak! 2 hours left.`,
        data: { type: 'streak_warning', endangeredStreaks: endangered },
      };
    });
  }

  @Cron('0 10 * * *', { timeZone: 'Europe/Warsaw' })
  async sendInactivityReminder() {
    await this.forEachNotification('inactivity_reminder', async (user) => {
      if (!user.token) return null;

      const lastActivity = await this.goalService.getLastActivityDate(user.userId);
      const daysSinceActivity = dayjs().diff(lastActivity, 'day');

      if (daysSinceActivity < 2) return null;

      return {
        to: user.token,
        title: 'We miss you! 👋',
        body: `It's been ${daysSinceActivity} days. Ready to get back on track?`,
        data: { type: 'inactivity_reminder', daysSinceActivity },
      };
    });
  }
}

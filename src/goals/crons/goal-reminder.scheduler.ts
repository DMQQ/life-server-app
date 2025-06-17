import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { BaseScheduler } from 'src/wallet/crons/scheduler-base.service';
import { GoalService } from '../goals.service';
import * as dayjs from 'dayjs';

@Injectable()
export class AlertsSchedulerService extends BaseScheduler {
  constructor(
    notificationService: NotificationsService,
    private goalService: GoalService,
  ) {
    super(notificationService);
  }

  // Morning motivation (8 AM)
  @Cron('0 8 * * *', { timeZone: 'Europe/Warsaw' })
  async sendMorningMotivation() {
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        const categories = await this.goalService.getUserCategories(user.id);
        if (categories.length === 0) continue;

        const message = `Good morning! You have ${categories.length} goals to work on today 🎯`;

        await this.sendSingleNotification({
          to: user.token,
          title: 'Daily Goals',
          body: message,
          data: { type: 'morning_motivation' },
        });
      } catch (error) {}
    }
  }

  // Midday check-in (12 PM)
  @Cron('0 12 * * *', { timeZone: 'Europe/Warsaw' })
  async sendMiddayCheckIn() {
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        const reminders = await this.goalService.getGoalReminders(user.id);
        const completed = reminders.filter((g) => g.isCompleted).length;
        const total = reminders.length;

        if (total === 0) continue;

        const message =
          completed === 0
            ? "Haven't started your goals yet? There's still time! 💪"
            : `Great job! ${completed}/${total} goals completed. Keep going! 🔥`;

        await this.sendSingleNotification({
          to: user.token,
          title: 'Midday Check-in',
          body: message,
          data: { type: 'midday_checkin', completed, total },
        });
      } catch (error) {}
    }
  }

  // Weekly summary (Sunday 6 PM)
  @Cron('0 18 * * 0', { timeZone: 'Europe/Warsaw' })
  async sendWeeklySummary() {
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        const weeklyStats = await this.goalService.getWeeklyStats(user.id);
        if (!weeklyStats) continue;

        const { completedDays, totalDays } = weeklyStats;
        const percentage = Math.round((completedDays / totalDays) * 100);

        await this.sendSingleNotification({
          to: user.token,
          title: 'Weekly Summary',
          body: `This week: ${percentage}% goal completion rate 📊`,
          data: { type: 'weekly_summary', completedDays, totalDays },
        });
      } catch (error) {}
    }
  }

  // Streak warning (when about to break streak)
  @Cron('0 22 * * *', { timeZone: 'Europe/Warsaw' })
  async sendStreakWarning() {
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        const streaks = await this.goalService.getUserStreaks(user.id);
        const endangered = streaks.filter((s) => s.days >= 3 && !s.completedToday);

        if (endangered.length === 0) continue;

        const longestStreak = Math.max(...endangered.map((s) => s.days));

        await this.sendSingleNotification({
          to: user.token,
          title: 'Streak Alert! ⚠️',
          body: `Don't break your ${longestStreak}-day streak! 2 hours left.`,
          data: { type: 'streak_warning', endangeredStreaks: endangered },
        });
      } catch (error) {}
    }
  }

  // Inactivity reminder (if no entries for 2+ days)
  @Cron('0 10 * * *', { timeZone: 'Europe/Warsaw' })
  async sendInactivityReminder() {
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        const lastActivity = await this.goalService.getLastActivityDate(user.id);
        const daysSinceActivity = dayjs().diff(lastActivity, 'day');

        if (daysSinceActivity >= 2) {
          await this.sendSingleNotification({
            to: user.token,
            title: 'We miss you! 👋',
            body: `It's been ${daysSinceActivity} days. Ready to get back on track?`,
            data: { type: 'inactivity_reminder', daysSinceActivity },
          });
        }
      } catch (error) {}
    }
  }
}

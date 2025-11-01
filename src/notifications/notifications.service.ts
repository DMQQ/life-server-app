import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { NotificationsEntity, NotificationsHistoryEntity } from 'src/notifications/notifications.entity';
import { Repository } from 'typeorm';
import { NotificationTypeDto } from './dto/notification-type.dto';
import { ApnService } from './apn.service';

@Injectable()
export class NotificationsService {
  expo: Expo;

  constructor(
    @InjectRepository(NotificationsEntity)
    private notificationsRepository: Repository<NotificationsEntity>,

    @InjectRepository(NotificationsHistoryEntity)
    private notificationHistoryRepository: Repository<NotificationsHistoryEntity>,

    private readonly apnService: ApnService,
  ) {
    this.expo = new Expo();
  }

  async sendChunkNotifications(messages: ExpoPushMessage[]) {
    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error(error);
      }
    }

    return tickets;
  }

  async saveBulkNotifications(notifications: (Record<string, any> & { userId: string })[]) {
    return this.notificationHistoryRepository.save(notifications.map((n) => ({ ...n, sendAt: new Date() })));
  }

  findAll(): Promise<NotificationsEntity[]> {
    return this.notificationsRepository.find();
  }

  findOne(id: string): Promise<NotificationsEntity> {
    return this.notificationsRepository.findOne({ where: { id } });
  }

  async remove(id: string): Promise<void> {
    await this.notificationsRepository.delete(id);
  }

  async create(token: string, userId: string) {
    const userToken = await this.findUserToken(userId);

    if (userToken) {
      await this.notificationsRepository.update(userToken.id, { token });
    } else {
      await this.notificationsRepository.insert({ token, userId });
    }

    return true;
  }

  findUserToken(userId: any): Promise<NotificationsEntity> {
    return this.notificationsRepository.findOne({ where: { userId } });
  }

  saveNotification(userId: string, message: Record<string, any>) {
    return this.notificationHistoryRepository.insert({
      userId,
      message,
      sendAt: new Date(),
    });
  }

  findNotifications(userId: string, skip = 0, take = 25) {
    return this.notificationHistoryRepository.find({ where: { userId }, skip, take, order: { sendAt: 'desc' } });
  }

  readNotification(id: string) {
    return this.notificationHistoryRepository.update({ id }, { read: true });
  }

  async unreadNotifications(userId: string) {
    return this.notificationHistoryRepository.findAndCount({
      where: { userId, read: false },
    });
  }

  async readAll(userId: string) {
    return this.notificationHistoryRepository.update({ userId }, { read: true });
  }

  async toggleEnabledNotifications(userId: string, input: Record<string, boolean>) {
    const result = await this.notificationsRepository.update({ userId }, { enabledNotifications: input });

    return this.notificationsRepository.findOne({ where: { userId } });
  }

  async sendTimelineLiveActivity(userId: string, event: any) {
    const userToken = await this.findUserToken(userId);

    if (userToken) {
      return this.apnService.sendTimelineActivity(userToken, event);
    } else {
      console.error(`No notification token found for userId: ${userId}`);
    }
  }

  async sendTimelineEndActivity(userId: string, event: any) {
    const userToken = await this.findUserToken(userId);

    if (userToken) {
      return this.apnService.endTimelineActivity(userToken, event);
    } else {
      console.error(`No notification token found for userId: ${userId}`);
    }
  }

  setPushToStartToken(userId: string, pushToStartToken: string) {
    return this.notificationsRepository.update({ userId }, { liveActivityToken: pushToStartToken });
  }

  getAvailableNotificationTypes(): NotificationTypeDto[] {
    return [
      {
        key: 'budgetAlerts',
        title: 'Budget Alerts',
        description: 'Get notified when you approach spending limits or have low balance',
        category: 'Wallet',
        schedule: 'Real-time',
      },
      {
        key: 'subscriptionReminders',
        title: 'Subscription Reminders',
        description: 'Reminders for upcoming subscription charges',
        category: 'Wallet',
        schedule: 'Daily at 9 AM',
      },
      {
        key: 'weeklyReport',
        title: 'Weekly Reports',
        description: 'Weekly spending summary and insights',
        category: 'Wallet',
        schedule: 'Sunday at 6 PM',
      },
      {
        key: 'monthlyReport',
        title: 'Monthly Reports',
        description: 'Monthly financial overview and statistics',
        category: 'Wallet',
        schedule: '1st of each month at 9 AM',
      },
      {
        key: 'expenseAnalysis',
        title: 'Expense Analysis',
        description: 'AI-powered spending pattern analysis',
        category: 'Wallet',
        schedule: 'Monday at 8 AM',
      },
      {
        key: 'dailyInsights',
        title: 'Daily Insights',
        description: 'Daily spending updates and balance information',
        category: 'Wallet',
        schedule: 'Daily at 7 PM',
      },
      {
        key: 'unusualSpending',
        title: 'Unusual Spending Alerts',
        description: 'Get alerted when spending significantly exceeds your average',
        category: 'Wallet',
        schedule: 'Wednesday at 6 PM',
      },
      {
        key: 'weekdayWeekendAnalysis',
        title: 'Spending Pattern Analysis',
        description: 'Analysis of weekday vs weekend spending patterns',
        category: 'Wallet',
        schedule: 'Friday at 5 PM',
      },
      {
        key: 'moneyLeftToday',
        title: "Today's Budget",
        description: 'Daily budget reminders and spending allowance',
        category: 'Wallet',
        schedule: 'Daily at 8 AM',
      },
      {
        key: 'monthlyCategoryComparison',
        title: 'Monthly Category Analysis',
        description: 'Compare spending across categories month-to-month',
        category: 'Wallet',
        schedule: 'Monthly',
      },
      {
        key: 'savingRateAnalysis',
        title: 'Saving Rate Insights',
        description: 'Monthly analysis of your saving rate and investment opportunities',
        category: 'Wallet',
        schedule: 'Monthly',
      },
      {
        key: 'spontaneousPurchaseAnalysis',
        title: 'Impulse Purchase Insights',
        description: 'Analysis of spontaneous purchases and saving opportunities',
        category: 'Wallet',
        schedule: 'Monthly',
      },
      {
        key: 'zeroSpendDayChallenge',
        title: 'Zero Spend Day Challenges',
        description: 'Challenges to take a break from spending and save money',
        category: 'Wallet',
        schedule: 'Weekly',
      },
      {
        key: 'roundUpSavingsOpportunity',
        title: 'Round-Up Savings Tips',
        description: 'Suggestions for automatic round-up savings based on transactions',
        category: 'Wallet',
        schedule: 'Weekly',
      },
      {
        key: 'morning_motivation',
        title: 'Morning Motivation',
        description: 'Start your day with goal motivation and overview',
        category: 'Goals',
        schedule: 'Daily at 8 AM',
      },
      {
        key: 'midday_checkin',
        title: 'Midday Check-in',
        description: 'Progress check and motivation boost during the day',
        category: 'Goals',
        schedule: 'Daily at 12 PM',
      },
      {
        key: 'weekly_summary',
        title: 'Weekly Goal Summary',
        description: 'Weekly progress report and completion statistics',
        category: 'Goals',
        schedule: 'Sunday at 6 PM',
      },
      {
        key: 'streak_warning',
        title: 'Streak Alert',
        description: 'Warning before breaking goal streaks',
        category: 'Goals',
        schedule: 'Daily at 10 PM',
      },
      {
        key: 'inactivity_reminder',
        title: 'Inactivity Reminder',
        description: 'Gentle reminder to get back on track after inactivity',
        category: 'Goals',
        schedule: 'Daily at 10 AM',
      },

      {
        key: 'daily_flashcard_tip',
        title: 'Daily Learning Tip',
        description: 'AI-powered learning tips based on your flashcard groups',
        category: 'Flashcards',
        schedule: 'Daily at 9 AM',
      },
      {
        key: 'weekly_flashcard_progress',
        title: 'Weekly Study Progress',
        description: 'Weekly flashcard mastery progress and statistics',
        category: 'Flashcards',
        schedule: 'Sunday at 10 AM',
      },
    ];
  }
}

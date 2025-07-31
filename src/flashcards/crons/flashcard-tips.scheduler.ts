import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { OpenAIService } from 'src/utils/services/OpenAI/openai.service';
import { BaseScheduler } from 'src/wallet/crons/scheduler-base.service';
import { FlashCardService } from '../flashcards.service';
import { GroupsService } from '../group.service';

@Injectable()
export class FlashcardTipsScheduler extends BaseScheduler {
  constructor(
    notificationService: NotificationsService,
    private groupsService: GroupsService,
    private flashCardService: FlashCardService,
    private openAIService: OpenAIService,
  ) {
    super(notificationService);
  }

  // Daily flashcard learning tip (9 AM)
  @Cron('0 9 * * *', { timeZone: 'Europe/Warsaw' })
  async sendDailyFlashcardTip() {
    this.logger.log('Sending daily flashcard learning tips');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (user.isEnable === false || !user.token) continue;

        const groups = await this.groupsService.findAll(user.userId);
        if (groups.length === 0) continue;

        const groupsWithCards = groups.filter((g) => g.flashcards && g.flashcards.length > 0);
        if (groupsWithCards.length === 0) continue;

        const randomGroup = groupsWithCards[Math.floor(Math.random() * groupsWithCards.length)];

        const flashcardQuestions = await this.flashCardService.getFlashCardsTitlesByGroup(randomGroup.id, user.userId);

        const content = `
            Group: ${randomGroup.name}
            Description: ${randomGroup.description || 'No description available'}
            Sample flashcard topics: ${flashcardQuestions.slice(0, 5).join(', ')}
            Total flashcards: ${flashcardQuestions.length}
        `.trim();

        const isLanguageGroup = this.isLanguageRelated(randomGroup.name, randomGroup.description);

        let tip: string;
        try {
          if (isLanguageGroup) {
            tip = await this.openAIService.generateLanguageLearningTip(content, randomGroup.name);
          } else {
            tip = await this.openAIService.generateGeneralLearningTip(content, randomGroup.name);
          }

          if (!tip) continue;
        } catch (error) {
          this.logger.error(`Error generating tip for group ${randomGroup.name}: ${error.message}`);
          continue;
        }

        const notification = {
          to: user.token,
          title: isLanguageGroup
            ? `📚 Daily Language Tip: ${randomGroup.name}`
            : `💡 Daily Learning Tip: ${randomGroup.name}`,
          body: this.truncateNotification(tip),
          data: {
            type: isLanguageGroup ? 'language_flashcard_tip' : 'flashcard_tip',
            groupId: randomGroup.id,
            groupName: randomGroup.name,
            isLanguage: isLanguageGroup,
          },
        };

        await this.sendSingleNotification(notification);
        await this.notificationService.saveNotification(user.userId, notification);

        this.logger.log(`Sent flashcard tip for group "${randomGroup.name}" to user ${user.userId}`);
      } catch (error) {
        this.logger.error(`Error sending flashcard tip to user ${user.userId}: ${error.message}`, error.stack);
      }
    }
  }

  private isLanguageRelated(groupName: string, description?: string): boolean {
    const languageKeywords = [
      'english',
      'german',
      'spanish',
      'french',
      'italian',
      'portuguese',
      'russian',
      'chinese',
      'japanese',
      'korean',
      'angielski',
      'niemiecki',
      'hiszpański',
      'francuski',
      'włoski',
      'portugalski',
      'rosyjski',
      'chiński',
      'japoński',
      'koreański',
      'vocabulary',
      'słówka',
      'words',
      'language',
      'język',
      'grammar',
      'gramatyka',
      'phrases',
      'zwroty',
      'conversation',
      'rozmowa',
      'pronunciation',
      'wymowa',
      'translation',
      'tłumaczenie',
    ];

    const textToCheck = `${groupName} ${description || ''}`.toLowerCase();
    return languageKeywords.some((keyword) => textToCheck.includes(keyword));
  }

  // Weekly flashcard progress reminder (Sunday 10 AM)
  @Cron('0 10 * * 0', { timeZone: 'Europe/Warsaw' })
  async sendWeeklyFlashcardProgress() {
    this.logger.log('Sending weekly flashcard progress reminders');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (user.isEnable === false || !user.token) continue;

        const groups = await this.groupsService.findAll(user.userId);
        if (groups.length === 0) continue;

        let totalCards = 0;
        let totalReviewed = 0;
        let masteredCards = 0;

        for (const group of groups) {
          const stats = await this.flashCardService.getGroupStats(group.id, user.userId);
          totalCards += stats.totalCards;
          totalReviewed += stats.totalReviewed;
          masteredCards += stats.masteredCards;
        }

        if (totalCards === 0) continue;

        const masteredPercentage = Math.round((masteredCards / totalCards) * 100);
        const avgReviewsPerCard = totalReviewed > 0 ? Math.round(totalReviewed / totalCards) : 0;

        let message = `📚 Week recap: ${masteredCards}/${totalCards} cards mastered (${masteredPercentage}%)`;

        if (masteredPercentage >= 70) {
          message += ` - Excellent progress! 🌟`;
        } else if (masteredPercentage >= 40) {
          message += ` - Good work, keep going! 💪`;
        } else {
          message += ` - More practice needed. You got this! 🎯`;
        }

        const notification = {
          to: user.token,
          title: '📊 Weekly Flashcard Progress',
          body: message,
          data: {
            type: 'weekly_flashcard_progress',
            totalCards,
            masteredCards,
            masteredPercentage,
            avgReviewsPerCard,
          },
        };

        await this.sendSingleNotification(notification);
        await this.notificationService.saveNotification(user.userId, notification);
      } catch (error) {
        this.logger.error(
          `Error sending weekly flashcard progress to user ${user.userId}: ${error.message}`,
          error.stack,
        );
      }
    }
  }
}

import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from 'src/notifications/notifications.service';
import { OpenAIService } from 'src/utils/services/OpenAI/openai.service';
import { BaseScheduler } from 'src/notifications/scheduler-base.service';
import { FlashCardService } from '../flashcards.service';
import { GroupsService } from '../group.service';
import { GenerateLanguageTipQuery } from 'src/utils/shared/AI/GenerateLanguageTipQuery';
import { GenerateGeneralTipQuery } from 'src/utils/shared/AI/GenerateGeneralTipQuery';

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

  @Cron('0 9 * * *', { timeZone: 'Europe/Warsaw' })
  async sendDailyFlashcardTip() {
    this.logger.log('Sending daily flashcard learning tips');

    await this.forEachNotification('daily_flashcard_tip', async (user) => {
      if (!user.token) return null;

      const groups = await this.groupsService.findAll(user.userId);
      if (groups.length === 0) return null;

      const groupsWithCards = groups.filter((g) => g.flashcards && g.flashcards.length > 0);
      if (groupsWithCards.length === 0) return null;

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
        tip = await this.openAIService.execute(
          isLanguageGroup ? new GenerateLanguageTipQuery() : new GenerateGeneralTipQuery(),
          { groupName: randomGroup.name, content },
        );

        if (!tip) return null;
      } catch (error: any) {
        this.logger.error(`Error generating tip for group ${randomGroup.name}: ${error?.message}`);
        return null;
      }

      return {
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
    });
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

  @Cron('0 10 * * 0', { timeZone: 'Europe/Warsaw' })
  async sendWeeklyFlashcardProgress() {
    this.logger.log('Sending weekly flashcard progress reminders');

    await this.forEachNotification('weekly_flashcard_progress', async (user) => {
      if (!user.token) return null;

      const groups = await this.groupsService.findAll(user.userId);
      if (groups.length === 0) return null;

      let totalCards = 0;
      let totalReviewed = 0;
      let masteredCards = 0;

      for (const group of groups) {
        const stats = await this.flashCardService.getGroupStats(group.id, user.userId);
        totalCards += stats.totalCards;
        totalReviewed += stats.totalReviewed;
        masteredCards += stats.masteredCards;
      }

      if (totalCards === 0) return null;

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

      return {
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
    });
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashCard, Group } from './flashcards.entity';
import { FlashCardResolver } from './flashcards.resolver';
import { FlashCardService } from './flashcards.service';
import { GroupsService } from './group.service';
import { GroupsResolver } from './group.resolver';
import { FlashcardTipsScheduler } from './crons/flashcard-tips.scheduler';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { OpenAIModule } from 'src/utils/services/OpenAI/openai.module';

@Module({
  imports: [TypeOrmModule.forFeature([FlashCard, Group]), NotificationsModule, OpenAIModule],
  providers: [
    FlashCardService,
    FlashCardResolver,
    GroupsService,
    GroupsResolver,
    FlashcardTipsScheduler,
  ],
  exports: [FlashCardService, GroupsService],
})
export class FlashcardsModule {}

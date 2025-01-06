import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashCard, Group } from './flashcards.entity';
import { FlashCardResolver } from './flashcards.resolver';
import { FlashCardService } from './flashcards.service';
import { GroupsService } from './group.service';
import { GroupsResolver } from './group.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([FlashCard, Group])],
  providers: [
    FlashCardService,
    FlashCardResolver,
    GroupsService,
    GroupsResolver,
  ],
})
export class FlashCardsModule {}

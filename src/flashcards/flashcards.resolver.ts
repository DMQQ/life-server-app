import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { FlashCardService } from './flashcards.service';
import { FlashCard } from './flashcards.entity';
import { UseInterceptors } from '@nestjs/common';
import { User } from '../utils/decorators/user.decorator';
import {
  AIGeneratedFlashCards,
  CreateFlashCardInput,
  GroupStats,
  ReviewFlashCardInput,
  UpdateFlashCardInput,
} from './flashcard.types';
import { OpenAIService } from 'src/utils/services/OpenAI/openai.service';
import {
  CacheInterceptor,
  DefaultCacheModule,
  InvalidateCache,
  InvalidateCacheInterceptor,
  UserCache,
} from 'src/utils/services/Cache/cache.decorator';

@UseInterceptors(CacheInterceptor, InvalidateCacheInterceptor)
@DefaultCacheModule('FlashCards', { invalidateCurrentUser: true })
@Resolver(() => FlashCard)
export class FlashCardResolver {
  constructor(
    private readonly flashCardService: FlashCardService,

    private readonly openAIService: OpenAIService,
  ) {}

  @Query(() => [FlashCard])
  @UserCache(3600)
  async flashCards(
    @User() userId: string,
    @Args('groupId', { type: () => ID, nullable: true }) groupId?: string,
  ): Promise<FlashCard[]> {
    return this.flashCardService.findAll(userId, groupId);
  }

  @Query(() => FlashCard)
  @UserCache(3600)
  async flashCard(@Args('id', { type: () => ID }) id: string, @User() userId: string): Promise<FlashCard> {
    return this.flashCardService.findOne(id, userId);
  }

  @Mutation(() => FlashCard)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createFlashCard(@Args('input') input: CreateFlashCardInput, @User() userId: string): Promise<FlashCard> {
    return this.flashCardService.create(input, userId);
  }

  @Mutation(() => FlashCard)
  @InvalidateCache({ invalidateCurrentUser: true })
  async updateFlashCard(@Args('input') input: UpdateFlashCardInput, @User() userId: string): Promise<FlashCard> {
    return this.flashCardService.update(input.id, input, userId);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async removeFlashCard(@Args('id', { type: () => ID }) id: string, @User() userId: string): Promise<boolean> {
    return this.flashCardService.remove(id, userId);
  }

  @Mutation(() => FlashCard)
  @InvalidateCache({ invalidateCurrentUser: true })
  async reviewFlashCard(@Args('input') input: ReviewFlashCardInput, @User() userId: string): Promise<FlashCard> {
    return this.flashCardService.review(input, userId);
  }

  @Query(() => FlashCard)
  @UserCache(3600)
  async flashCardStats(@Args('id', { type: () => ID }) id: string, @User() userId: string) {
    return this.flashCardService.getStats(id, userId);
  }

  @Query(() => GroupStats)
  @UserCache(3600)
  async groupStats(@Args('groupId', { type: () => ID }) groupId: string, @User() userId: string) {
    return this.flashCardService.getGroupStats(groupId, userId);
  }

  @Query(() => [AIGeneratedFlashCards])
  @UserCache(3600)
  async generateAIFlashcards(@Args('content') content: string) {
    return this.openAIService.generateFlashCards(content);
  }
}

import { BadRequestException, NotFoundException, UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, Field, ID, InputType, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User } from 'src/utils/decorators/user.decorator';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import {
  CacheInterceptor,
  DefaultCacheModule,
  InvalidateCache,
  InvalidateCacheInterceptor,
  UserCache,
} from 'src/utils/services/Cache/cache.decorator';
import {
  CreateEventInput,
  CopyOccurrenceInput,
  EditOccurrenceInput,
  MonthDay,
  OccurrenceTodoView,
  OccurrenceView,
  RepeatInput,
} from './timeline.schemas';
import { EventOccurrenceService } from './event-occurrence.service';
import { OccurrenceTodoEntity, TodoFilesEntity } from './entities/occurrence-todo.entity';

@InputType()
class PaginationInput {
  @Field(() => Int)
  skip: number;

  @Field(() => Int)
  take: number;
}

@UseGuards(AuthGuard)
@UseInterceptors(CacheInterceptor, InvalidateCacheInterceptor)
@DefaultCacheModule('Timeline', { invalidateCurrentUser: true })
@Resolver(() => OccurrenceView)
export class EventOccurrenceResolver {
  constructor(private occurrenceService: EventOccurrenceService) {}

  // ─── Queries ─────────────────────────────────────────────────────────────────

  @Query(() => [OccurrenceView])
  @UserCache(3600)
  occurrences(
    @User() userId: string,
    @Args('date', { nullable: true }) date: string,
    @Args('query', { nullable: true }) query: string,
    @Args('pagination', { nullable: true, type: () => PaginationInput }) pagination: PaginationInput,
  ) {
    return this.occurrenceService.findByDate({ userId, date, query, pagination });
  }

  @Query(() => [MonthDay])
  @UserCache(3600)
  async occurrenceMonth(
    @User() userId: string,
    @Args('date', { nullable: false }) date: string,
  ) {
    return this.occurrenceService.findMonthOccurrences(userId, date);
  }

  @Query(() => OccurrenceView)
  @UserCache(3600)
  async occurrenceById(
    @Args('id', { type: () => String }) id: string,
    @User() userId: string,
  ) {
    return this.occurrenceService.findById(id, userId);
  }

  @Query(() => [OccurrenceView])
  @UserCache(3600)
  async occurrencesByCurrentDate(@User() userId: string) {
    return this.occurrenceService.findByCurrentDate(userId);
  }

  // ─── Mutations ───────────────────────────────────────────────────────────────

  @Mutation(() => OccurrenceView)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createEvent(
    @Args('input', { type: () => CreateEventInput }) input: CreateEventInput,
    @Args('repeat', { type: () => RepeatInput, nullable: true }) repeat: RepeatInput,
    @User() userId: string,
  ) {
    const result = await this.occurrenceService.createEvent({ ...input, userId }, repeat);
    if (!result) throw new BadRequestException('Failed to create event');
    return result;
  }

  @Mutation(() => OccurrenceView)
  @InvalidateCache({ invalidateCurrentUser: true })
  async editOccurrence(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => EditOccurrenceInput }) input: EditOccurrenceInput,
    @Args('scope', { type: () => String, defaultValue: 'THIS_ONLY' }) scope: 'THIS_ONLY' | 'ALL',
    @User() userId: string,
  ) {
    return this.occurrenceService.editOccurrence(id, userId, input, scope);
  }

  @Mutation(() => OccurrenceView)
  @InvalidateCache({ invalidateCurrentUser: true })
  async completeOccurrence(
    @Args('id', { type: () => ID }) id: string,
    @Args('isCompleted', { type: () => Boolean }) isCompleted: boolean,
  ) {
    return this.occurrenceService.completeOccurrence(id, isCompleted);
  }

  @Mutation(() => OccurrenceView)
  @InvalidateCache({ invalidateCurrentUser: true })
  async skipOccurrence(@Args('id', { type: () => ID }) id: string) {
    return this.occurrenceService.skipOccurrence(id);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async deleteOccurrence(
    @Args('id', { type: () => ID }) id: string,
    @Args('scope', { type: () => String, defaultValue: 'THIS_ONLY' }) scope: 'THIS_ONLY' | 'ALL',
    @User() userId: string,
  ) {
    return this.occurrenceService.deleteOccurrence(id, userId, scope);
  }

  @Mutation(() => OccurrenceView)
  @InvalidateCache({ invalidateCurrentUser: true })
  async copyOccurrence(
    @Args('occurrenceId', { type: () => ID }) occurrenceId: string,
    @Args('input', { type: () => CopyOccurrenceInput, nullable: true }) input: CopyOccurrenceInput,
    @User() userId: string,
  ) {
    return this.occurrenceService.copyOccurrence(occurrenceId, userId, input?.newDate);
  }

  @Mutation(() => OccurrenceTodoEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createOccurrenceTodo(
    @Args('occurrenceId', { type: () => ID }) occurrenceId: string,
    @Args('title', { type: () => String }) title: string,
  ) {
    return this.occurrenceService.createTodo(occurrenceId, title);
  }

  @Mutation(() => OccurrenceTodoEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async completeOccurrenceTodo(
    @Args('id', { type: () => ID }) id: string,
    @Args('isCompleted', { type: () => Boolean }) isCompleted: boolean,
  ) {
    return this.occurrenceService.completeTodo(id, isCompleted);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async removeOccurrenceTodo(@Args('id', { type: () => ID }) id: string) {
    return this.occurrenceService.removeTodo(id);
  }

  @Mutation(() => TodoFilesEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async addTodoFile(
    @Args('todoId', { type: () => ID }) todoId: string,
    @Args('type', { type: () => String }) type: string,
    @Args('url', { type: () => String }) url: string,
  ) {
    return this.occurrenceService.addTodoFile(todoId, type, url);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async removeTodoFile(@Args('fileId', { type: () => ID }) fileId: string) {
    return this.occurrenceService.removeTodoFile(fileId);
  }

  @Query(() => OccurrenceTodoEntity)
  @UserCache(3600)
  async occurrenceTodo(@Args('id', { type: () => ID }) id: string) {
    return this.occurrenceService.getTodo(id);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async transferTodos(
    @Args('sourceOccurrenceId', { type: () => ID }) sourceOccurrenceId: string,
    @Args('targetOccurrenceId', { type: () => ID }) targetOccurrenceId: string,
  ) {
    return this.occurrenceService.transferTodos(sourceOccurrenceId, targetOccurrenceId);
  }
}

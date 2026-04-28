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
  OccurrenceView,
  RepeatInput,
} from './timeline.schemas';
import { EventOccurrenceService } from './event-occurrence.service';
import { OccurrenceTodoEntity, TodoFilesEntity } from './entities/occurrence-todo.entity';
import {
  AddTodoFileInput,
  CompleteOccurrenceInput,
  CompleteOccurrenceTodoInput,
  CopyOccurrenceArgsInput,
  CreateEventWithRepeatInput,
  CreateOccurrenceTodoInput,
  DeleteOccurrenceInput,
  EditOccurrenceArgsInput,
  ExtractTasksArgs,
  ExtractTasksResponse,
  TransferTodosInput,
} from './dto/timeline.dto';
import { EventOccurrenceEntity } from './entities/event-occurrence.entity';
import dayjs from 'dayjs';
import { OpenAIService } from 'src/utils/services/OpenAI/openai.service';
import { ExtractTasksQuery } from 'src/utils/shared/AI/ExtractTasksQuery';

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
  constructor(
    private occurrenceService: EventOccurrenceService,
    private openAIService: OpenAIService,
  ) {}

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
  async occurrenceMonth(@User() userId: string, @Args('date', { nullable: false }) date: string) {
    return this.occurrenceService.findMonthOccurrences(userId, date);
  }

  @Query(() => OccurrenceView)
  @UserCache(3600)
  async occurrenceById(@Args('id', { type: () => String }) id: string, @User() userId: string) {
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
    @Args('input', { type: () => CreateEventWithRepeatInput }) { input, repeat }: CreateEventWithRepeatInput,
    @User() userId: string,
  ) {
    const result = await this.occurrenceService.createEvent({ ...input, userId }, repeat);
    if (!result) throw new BadRequestException('Failed to create event');
    return result;
  }

  @Mutation(() => OccurrenceView)
  @InvalidateCache({ invalidateCurrentUser: true })
  async editOccurrence(
    @Args('input', { type: () => EditOccurrenceArgsInput }) { id, input, scope = 'THIS_ONLY' }: EditOccurrenceArgsInput,
    @User() userId: string,
  ) {
    return this.occurrenceService.editOccurrence(id, userId, input, scope as 'THIS_ONLY' | 'ALL');
  }

  @Mutation(() => OccurrenceView)
  @InvalidateCache({ invalidateCurrentUser: true })
  async completeOccurrence(
    @Args('input', { type: () => CompleteOccurrenceInput }) { id, isCompleted }: CompleteOccurrenceInput,
  ) {
    return this.occurrenceService.completeOccurrence(id, isCompleted);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async deleteOccurrence(
    @Args('input', { type: () => DeleteOccurrenceInput }) { id, scope = 'THIS_ONLY' }: DeleteOccurrenceInput,
    @User() userId: string,
  ) {
    return this.occurrenceService.deleteOccurrence(id, userId, scope as 'THIS_ONLY' | 'ALL');
  }

  @Mutation(() => OccurrenceView)
  @InvalidateCache({ invalidateCurrentUser: true })
  async copyOccurrence(
    @Args('input', { type: () => CopyOccurrenceArgsInput }) { occurrenceId, input }: CopyOccurrenceArgsInput,
    @User() userId: string,
  ) {
    return this.occurrenceService.copyOccurrence(occurrenceId, userId, input?.newDate);
  }

  @Mutation(() => OccurrenceTodoEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createOccurrenceTodo(
    @Args('input', { type: () => CreateOccurrenceTodoInput }) { occurrenceId, title }: CreateOccurrenceTodoInput,
  ) {
    return this.occurrenceService.createTodo(occurrenceId, title);
  }

  @Mutation(() => OccurrenceTodoEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async completeOccurrenceTodo(
    @Args('input', { type: () => CompleteOccurrenceTodoInput }) { id, isCompleted }: CompleteOccurrenceTodoInput,
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
  async addTodoFile(@Args('input', { type: () => AddTodoFileInput }) { todoId, type, url }: AddTodoFileInput) {
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
    @Args('input', { type: () => TransferTodosInput }) { sourceOccurrenceId, targetOccurrenceId }: TransferTodosInput,
  ) {
    return this.occurrenceService.transferTodos(sourceOccurrenceId, targetOccurrenceId);
  }

  @Mutation(() => ExtractTasksResponse)
  async timelineExtractTasks(@Args() args: ExtractTasksArgs): Promise<ExtractTasksResponse> {
    console.log('Extracting tasks with args:', args);
    const { content, currentDate, history } = args;

    const referenceDate = currentDate || dayjs().format('YYYY-MM-DD');

    const result = await this.openAIService.execute(new ExtractTasksQuery(), {
      content,
      currentDate: referenceDate,
      history,
    });

    const tasks: EventOccurrenceEntity[] = (result.tasks || []).map((t: any) => {
      const occ = new EventOccurrenceEntity();
      occ.titleOverride = t.titleOverride ?? null;
      occ.descriptionOverride = t.descriptionOverride ?? null;
      occ.date = t.date ?? null;
      occ.beginTimeOverride = t.beginTimeOverride ?? null;
      occ.endTimeOverride = t.endTimeOverride ?? null;
      occ.isCompleted = false;
      occ.isSkipped = false;
      occ.position = 0;
      occ.isRepeat = t.isRepeat ?? false;
      occ.repeatFrequency = t.repeatFrequency ?? null;
      occ.repeatEveryNth = t.repeatEveryNth ?? null;
      occ.repeatCount = t.repeatCount ?? null;
      occ.todos = (t.todos || []).map((title: string) => {
        const todo = new OccurrenceTodoEntity();
        todo.title = title;
        todo.isCompleted = false;
        return todo;
      });
      return occ;
    });

    return { message: result.message, tasks };
  }
}

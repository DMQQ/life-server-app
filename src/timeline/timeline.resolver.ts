import {
  Args,
  Field,
  ID,
  InputType,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { TimelineService } from './timeline.service';
import {
  TimelineEntity,
  TimelineFilesEntity,
  TimelineTodosEntity,
} from 'src/timeline/timeline.entity';
import { User } from 'src/utils/decorators/User';
import { CreateTimelineInput, RepeatableTimeline } from './timeline.schemas';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/utils/guards/AuthGuard';

@InputType()
class TimelineTodo {
  @Field(() => ID)
  timelineId: string;

  @Field()
  title: string;
}

@InputType()
class PaginationInput {
  @Field(() => Int)
  skip: number;

  @Field(() => Int)
  take: number;
}

@UseGuards(AuthGuard)
@Resolver(() => TimelineEntity)
export class TimelineResolver {
  constructor(private timelineService: TimelineService) {}

  @Query(() => [TimelineEntity])
  timeline(
    @User() userId: string,
    @Args('date', { nullable: true }) date: string,
    @Args('pagination', { nullable: true, type: () => PaginationInput })
    pagination: PaginationInput,
  ) {
    return this.timelineService.findAllByUserId({ userId, date, pagination });
  }

  @Query(() => [TimelineEntity])
  async timelineMonth(
    @User() userId: string,
    @Args('date', { nullable: false }) date: string,
  ) {
    const timeline = await this.timelineService.findUserMonthEvents(
      userId,
      date,
    );

    if (timeline === null || timeline === undefined)
      throw new NotFoundException(`Timeline with current date not found`);

    return timeline;
  }

  @Query(() => TimelineEntity)
  async timelineById(
    @Args('id', { nullable: false, type: () => String }) id: string,

    @User() userId: string,
  ) {
    const timeline = await this.timelineService.findOneById(id, userId);

    if (timeline === null || timeline === undefined)
      throw new NotFoundException(`Timeline with id ${id} not found`);

    return timeline;
  }

  @Query(() => [TimelineEntity])
  async timelineByCurrentDate(@User() userId: string) {
    const timeline = await this.timelineService.findByCurrentDate(userId);

    if (timeline === null || timeline === undefined)
      throw new NotFoundException(`Timeline with current date not found`);

    return timeline;
  }

  @Mutation(() => TimelineEntity)
  createTimeline(
    @Args('input', { type: () => CreateTimelineInput })
    input: CreateTimelineInput,

    @Args('options', { type: () => RepeatableTimeline, nullable: true })
    options: RepeatableTimeline,

    @User() userId: string,
  ) {
    return this.timelineService.createRepeatableTimeline(
      { ...input, userId },
      options,
    );
  }

  @Mutation(() => TimelineEntity)
  async completeTimeline(
    @User() usrId: string,
    @Args('id', { nullable: false, type: () => String }) id: string,
  ) {
    const updateResult = await this.timelineService.completeTimeline(id, usrId);

    if (updateResult === null || updateResult === undefined)
      throw new NotFoundException(`Timeline with id ${id} not found`);

    return this.timelineService.findOneById(id, usrId);
  }

  @Mutation(() => Boolean)
  async removeTimeline(
    @Args('id', { nullable: false, type: () => String }) id: string,
    @User() userId: string,
  ) {
    await this.timelineService.removeTimeline(id, userId);
    return true;
  }

  @Mutation(() => TimelineTodosEntity)
  async createTimelineTodos(
    @User() usrId: string,
    @Args('todos', { type: () => [TimelineTodo] }) todos: TimelineTodo[],
  ) {
    const todoInsert = await this.timelineService.createTimelineTodos(todos);

    return this.timelineService.findTodoById(todoInsert.generatedMaps[0].id);
  }

  @Mutation(() => Boolean)
  async removeTimelineTodo(
    @Args('id', { nullable: false, type: () => ID }) id: string,
  ) {
    await this.timelineService.removeTimelineTodo(id);
    return true;
  }

  @Mutation(() => TimelineTodosEntity)
  async completeTimelineTodo(
    @Args('id', { nullable: false, type: () => ID }) id: string,
  ) {
    await this.timelineService.completeTimelineTodo(id);

    return this.timelineService.findTodoById(id);
  }

  @ResolveField('images', () => [TimelineFilesEntity])
  async images(
    @Parent() timeline: TimelineEntity,
    @Args('pagination', { nullable: true, type: () => PaginationInput })
    pagination: PaginationInput,
  ) {
    return timeline.images.slice(
      pagination?.skip || 0,
      pagination?.skip + pagination?.take || timeline.images.length,
    );
  }
}

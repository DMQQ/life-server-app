import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { OccurrenceTodoEntity, TodoFilesEntity } from './entities/occurrence-todo.entity';
import { OccurrenceFileEntity } from './entities/occurrence-file.entity';

// ─── Input Types ────────────────────────────────────────────────────────────────

@InputType()
export class CreateEventInput {
  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  beginTime: string;

  @Field()
  endTime: string;

  @Field({ nullable: true })
  date?: string;

  @Field()
  tags: string;

  @Field(() => Int, { nullable: true })
  priority?: number;

  @Field(() => [String], { nullable: true })
  todos?: string[];
}

@InputType()
export class RepeatInput {
  // ── New recurrence fields ──
  @Field(() => String, { nullable: true })
  repeatType?: string; // 'DAILY' | 'WEEKLY' | 'MONTHLY'

  @Field(() => [Int], { nullable: true })
  repeatDaysOfWeek?: number[]; // [0,2,4] for Sun/Tue/Thu (0=Sun, 6=Sat)

  @Field(() => Int, { nullable: true })
  repeatInterval?: number; // every N days/weeks/months

  @Field({ nullable: true })
  repeatUntil?: string; // YYYY-MM-DD, null = infinite

  @Field(() => Int, { nullable: true })
  reminderBeforeMinutes?: number; // N minutes before beginTime to notify

  // ── Legacy fields (kept for backward compat during migration) ──
  @Field(() => Int, { nullable: true })
  repeatCount?: number;

  @Field({ nullable: true })
  repeatOn?: string; // 'daily' | 'weekly' (legacy)

  @Field(() => Int, { nullable: true })
  repeatEveryNth?: number;

  @Field({ nullable: true })
  startDate?: string;
}

@InputType()
export class EditOccurrenceInput {
  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  beginTime?: string;

  @Field({ nullable: true })
  endTime?: string;

  @Field({ nullable: true })
  date?: string;

  @Field({ nullable: true })
  tags?: string;

  @Field(() => Int, { nullable: true })
  priority?: number;
}

@InputType()
export class CopyOccurrenceInput {
  @Field({ nullable: true })
  newDate?: string;
}

// ─── Output Types ───────────────────────────────────────────────────────────────

@ObjectType()
export class OccurrenceTodoView {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  isCompleted: boolean;

  @Field(() => [TodoFilesEntity])
  files: TodoFilesEntity[];

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  modifiedAt: Date;
}

@ObjectType()
export class OccurrenceFileView {
  @Field(() => ID)
  id: string;

  @Field()
  url: string;

  @Field()
  type: string;

  @Field()
  name: string;

  @Field()
  isPublic: boolean;
}

@ObjectType()
export class OccurrenceView {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  seriesId: string;

  @Field({ nullable: true })
  date: string | null;

  @Field(() => Int)
  position: number;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field({ nullable: true })
  beginTime: string;

  @Field({ nullable: true })
  endTime: string;

  @Field()
  isCompleted: boolean;

  @Field()
  isSkipped: boolean;

  @Field()
  isAllDay: boolean;

  @Field()
  isRepeat: boolean;

  @Field()
  tags: string;

  @Field(() => Int)
  priority: number;

  @Field(() => Int, { nullable: true })
  reminderBeforeMinutes?: number;

  @Field(() => [OccurrenceTodoView])
  todos: OccurrenceTodoView[];

  @Field(() => [OccurrenceFileView])
  images: OccurrenceFileView[];
}

@ObjectType()
export class MonthDay {
  @Field()
  date: string;
}

// Keep legacy input types for backward compatibility during migration
@InputType()
export class CreateTimelineInput {
  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  beginTime: string;

  @Field()
  endTime: string;

  @Field()
  date: string;

  @Field()
  tags: string;

  @Field(() => [String], { nullable: true })
  todos?: string[];
}

@InputType()
export class CopyTimelineInput {
  @Field({ nullable: true })
  newDate?: string;
}

@InputType()
export class RepeatableTimeline {
  @Field(() => Int, { nullable: true })
  reapeatCount: number;

  @Field({ nullable: true })
  repeatUntil: string;

  @Field({ nullable: true })
  repeatOn: string;

  @Field(() => Int, { nullable: true })
  repeatEveryNth: number;

  @Field({ nullable: true })
  startDate: string;
}

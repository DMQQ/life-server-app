import { ArgsType, Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { EventOccurrenceEntity } from '../entities/event-occurrence.entity';
import { CreateEventInput, CopyOccurrenceInput, EditOccurrenceInput, RepeatInput } from '../timeline.schemas';

@ObjectType()
export class ExtractTasksResponse {
  @Field()
  message: string;

  @Field(() => [EventOccurrenceEntity])
  tasks: EventOccurrenceEntity[];
}

@InputType()
class TaskHistory {
  @Field(() => String)
  role: string;

  @Field(() => String)
  content: string;
}

@InputType()
export class CreateEventWithRepeatInput {
  @Field(() => CreateEventInput)
  input: CreateEventInput;

  @Field(() => RepeatInput, { nullable: true })
  repeat?: RepeatInput;
}

@InputType()
export class EditOccurrenceArgsInput {
  @Field(() => ID)
  id: string;

  @Field(() => EditOccurrenceInput)
  input: EditOccurrenceInput;

  @Field(() => String, { defaultValue: 'THIS_ONLY' })
  scope?: string;
}

@InputType()
export class CompleteOccurrenceInput {
  @Field(() => ID)
  id: string;

  @Field(() => Boolean)
  isCompleted: boolean;
}

@InputType()
export class DeleteOccurrenceInput {
  @Field(() => ID)
  id: string;

  @Field(() => String, { defaultValue: 'THIS_ONLY' })
  scope?: string;
}

@InputType()
export class CopyOccurrenceArgsInput {
  @Field(() => ID)
  occurrenceId: string;

  @Field(() => CopyOccurrenceInput, { nullable: true })
  input?: CopyOccurrenceInput;
}

@InputType()
export class CreateOccurrenceTodoInput {
  @Field(() => ID)
  occurrenceId: string;

  @Field(() => String)
  title: string;
}

@InputType()
export class CompleteOccurrenceTodoInput {
  @Field(() => ID)
  id: string;

  @Field(() => Boolean)
  isCompleted: boolean;
}

@InputType()
export class AddTodoFileInput {
  @Field(() => ID)
  todoId: string;

  @Field(() => String)
  type: string;

  @Field(() => String)
  url: string;
}

@InputType()
export class TransferTodosInput {
  @Field(() => ID)
  sourceOccurrenceId: string;

  @Field(() => ID)
  targetOccurrenceId: string;
}

@ArgsType()
export class ExtractTasksArgs {
  @Field()
  content: string;

  @Field({ nullable: true, description: 'YYYY-MM-DD. Defaults to today.' })
  currentDate?: string;

  @Field(() => [TaskHistory], { nullable: true, description: 'Optional history of past tasks for better context.' })
  history?: TaskHistory[];
}

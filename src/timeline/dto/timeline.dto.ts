import { ArgsType, Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { EventOccurrenceEntity } from '../entities/event-occurrence.entity';

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

@ArgsType()
export class ExtractTasksArgs {
  @Field()
  content: string;

  @Field({ nullable: true, description: 'YYYY-MM-DD. Defaults to today.' })
  currentDate?: string;

  @Field(() => [TaskHistory], { nullable: true, description: 'Optional history of past tasks for better context.' })
  history?: TaskHistory[];
}

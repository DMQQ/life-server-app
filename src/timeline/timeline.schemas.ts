import { Field, InputType, Int } from '@nestjs/graphql';

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

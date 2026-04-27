import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class UpsertGoalStatsInput {
  @Field(() => ID)
  goalsId: string;

  @Field(() => Number)
  value: number;

  @Field(() => Date, { nullable: true })
  date?: Date;
}

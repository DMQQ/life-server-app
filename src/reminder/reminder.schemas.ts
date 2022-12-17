import { ObjectType, Int, ID, InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateReminder {
  @Field(() => String)
  title: string;

  @Field(() => String)
  description: string;

  @Field(() => Int)
  repeatEvery: number;

  @Field(() => Date, { nullable: true })
  exactDate: Date;

  @Field(() => Boolean)
  repeat: boolean;
}

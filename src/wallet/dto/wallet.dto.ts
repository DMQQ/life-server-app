import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TransferResult {
  @Field(() => ID)
  from: string;

  @Field(() => ID)
  to: string;

  @Field(() => Float)
  amount: number;
}

@InputType()
export class CreateSubAccountInput {
  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  color?: string;

  @Field(() => String, { nullable: true })
  icon?: string;

  @Field(() => Float, { nullable: true })
  balance?: number;
}

@InputType()
export class UpdateSubAccountInput {
  @Field({ nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  color?: string;

  @Field(() => String, { nullable: true })
  icon?: string;

  @Field(() => Float, { nullable: true })
  balance?: number;
}

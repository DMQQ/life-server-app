import { InputType, Field, Int, ID, ObjectType } from '@nestjs/graphql';

@InputType()
export class CreateAccountInput {
  @Field(() => String, { nullable: true })
  email: string;

  @Field(() => String)
  password: string;

  @Field(() => String, { nullable: true })
  firstName: string;

  @Field(() => String, { nullable: true })
  lastName: string;

  @Field(() => String, { nullable: true })
  age?: number;
}

@ObjectType()
export class CreateAccountOutput {
  @Field(() => String)
  token: string;

  @Field(() => String)
  email: string;

  @Field(() => String)
  message: string;

  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  error: string;

  @Field(() => String)
  id: string;
}

@InputType()
export class LoginAccountInput {
  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String)
  password: string;

  @Field(() => Int, { nullable: true })
  phone?: number;
}

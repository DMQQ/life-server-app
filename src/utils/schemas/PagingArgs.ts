import { ArgsType, Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class PagingArgs {
  @Field(() => Int)
  skip: number = 0;

  @Field(() => Int)
  limit: number = 5;

  static DEFAULT_SKIP = 0;
  static DEFAULT_LIMIT = 5;
}

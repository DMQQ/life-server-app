import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SuccessfulRemoval {
  @Field(() => Boolean)
  isDeleted: boolean;

  @Field(() => ID)
  deletedId: string;
}

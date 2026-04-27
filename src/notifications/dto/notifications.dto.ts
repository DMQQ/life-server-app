import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class SetNotificationsTokenInput {
  @Field(() => String)
  token: string;
}

@InputType()
export class SetPushToStartTokenInput {
  @Field(() => String)
  pushToStartToken: string;
}

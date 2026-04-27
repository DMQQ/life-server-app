import { Field, InputType } from '@nestjs/graphql';
import { ChatMessageInput } from '../ai-chat.schemas';

@InputType()
export class AiChatInput {
  @Field(() => String)
  message: string;

  @Field(() => String, { nullable: true })
  startDate?: string;

  @Field(() => String, { nullable: true })
  endDate?: string;

  @Field(() => [ChatMessageInput], { nullable: true, defaultValue: [] })
  history?: ChatMessageInput[];
}

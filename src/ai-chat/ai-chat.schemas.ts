import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ExpenseEntity } from 'src/wallet/entities/wallet.entity';
import { SubscriptionEntity } from 'src/wallet/entities/subscription.entity';
import { EventOccurrenceEntity } from 'src/timeline/entities/event-occurrence.entity';

@InputType()
export class ChatMessageInput {
  @Field(() => String)
  role: 'user' | 'assistant';

  @Field(() => String)
  content: string;
}

@ObjectType()
export class AiChatMessageItem {
  @Field(() => String)
  type: string;

  @Field(() => String, { nullable: true })
  data?: string;

  @Field(() => String, { nullable: true })
  subtype?: string;
}

@ObjectType()
export class AiChatResponse {
  @Field(() => [AiChatMessageItem])
  messages: AiChatMessageItem[];
}

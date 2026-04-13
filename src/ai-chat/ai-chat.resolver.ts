import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { User } from 'src/utils/decorators/user.decorator';
import { WalletId } from 'src/utils/decorators/wallet.decorator';
import { AiChatService } from './ai-chat.service';
import { AiChatResponse, ChatMessageInput } from './ai-chat.schemas';

@Resolver()
export class AiChatResolver {
  constructor(private aiChatService: AiChatService) {}

  @Query(() => [AiChatResponse])
  async aiChatHistory(@User() userId: string): Promise<AiChatResponse[]> {
    const history = await this.aiChatService.getHistory(userId);
    return history.map((item) => ({ messages: item.aiMessages ?? [] }));
  }

  @Mutation(() => AiChatResponse)
  async aiChat(
    @User() userId: string,
    @WalletId() walletId: string,
    @Args('message') message: string,
    @Args('startDate', { nullable: true }) startDate: string,
    @Args('endDate', { nullable: true }) endDate: string,
    @Args('history', { type: () => [ChatMessageInput], nullable: true, defaultValue: [] })
    history: ChatMessageInput[],
  ): Promise<AiChatResponse> {
    const values = await this.aiChatService.chat({ userId, walletId, message, startDate, endDate, history });
    console.log('aiChat values', JSON.stringify(values, null, 2));
    return values;
  }
}

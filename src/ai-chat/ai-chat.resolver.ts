import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { User } from 'src/utils/decorators/user.decorator';
import { WalletId } from 'src/utils/decorators/wallet.decorator';
import { AiChatService } from './ai-chat.service';
import { AiChatResponse, ChatMessageInput } from './ai-chat.schemas';
import { AiChatInput } from './dto/ai-chat.dto';

@Resolver()
export class AiChatResolver {
  constructor(private aiChatService: AiChatService) {}

  @Query(() => [AiChatResponse])
  async aiChatHistory(@User() userId: string): Promise<AiChatResponse[]> {
    const history = await this.aiChatService.getHistory(userId);
    return history.map((item) => ({ messages: item.messages }));
  }

  @Mutation(() => AiChatResponse)
  async aiChat(
    @User() userId: string,
    @WalletId() walletId: string,
    @Args('input', { type: () => AiChatInput }) input: AiChatInput,
  ): Promise<AiChatResponse> {
    const agentResponse = await this.aiChatService.agentChat({
      userId,
      walletId,
      message: input.message,
      startDate: input.startDate,
      endDate: input.endDate,
      history: input.history,
    });

    return agentResponse;
  }
}

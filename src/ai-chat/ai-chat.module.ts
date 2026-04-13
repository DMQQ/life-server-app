import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatHistoryEntity } from './ai-chat-history.entity';
import { AiChatService } from './ai-chat.service';
import { AiChatResolver } from './ai-chat.resolver';
import { OpenAIModule } from 'src/utils/services/OpenAI/openai.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { TimelineModule } from 'src/timeline/timeline.module';

@Module({
  imports: [WalletModule, TimelineModule, TypeOrmModule.forFeature([AiChatHistoryEntity]), OpenAIModule],
  providers: [AiChatService, AiChatResolver],
})
export class AiChatModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatHistoryEntity } from './ai-chat-history.entity';
import { AiChatService } from './ai-chat.service';
import { AiChatResolver } from './ai-chat.resolver';
import { OpenAIModule } from 'src/utils/services/OpenAI/openai.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { TimelineModule } from 'src/timeline/timeline.module';
import { ExpenseWidgetResolver } from './widgets/expense.widget';
import { EventWidgetResolver } from './widgets/event.widget';
import { SubscriptionWidgetResolver } from './widgets/subscription.widget';
import { ChartWidgetResolver } from './widgets/chart.widget';
import { TimelineWidgetResolver } from './widgets/timeline.widget';
import { SuggestCreateExpenseWidget } from './widgets/suggest-create-expense.widget';
import { SuggestUpdateExpenseWidget } from './widgets/suggest-update-expense.widget';
import { SuggestCreateEventWidget } from './widgets/suggest-create-event.widget';
import { SuggestUpdateEventWidget } from './widgets/suggest-update-event.widget';
import { WidgetRegistry } from './widgets/widget.registry';

@Module({
  imports: [WalletModule, TimelineModule, TypeOrmModule.forFeature([AiChatHistoryEntity]), OpenAIModule],
  providers: [
    AiChatService,
    AiChatResolver,
    ExpenseWidgetResolver,
    EventWidgetResolver,
    SubscriptionWidgetResolver,
    ChartWidgetResolver,
    TimelineWidgetResolver,
    SuggestCreateExpenseWidget,
    SuggestUpdateExpenseWidget,
    SuggestCreateEventWidget,
    SuggestUpdateEventWidget,
    WidgetRegistry,
  ],
})
export class AiChatModule {}

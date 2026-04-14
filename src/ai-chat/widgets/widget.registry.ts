import { Injectable } from '@nestjs/common';
import { AiMessageItem } from 'src/utils/shared/AI/StatisticsChatQuery';
import { AiChatMessageItem } from '../ai-chat.schemas';
import { ToolContext } from '../tools/base.tool';
import { BaseWidgetResolver } from './base.widget';
import { ExpenseWidgetResolver } from './expense.widget';
import { EventWidgetResolver } from './event.widget';
import { SubscriptionWidgetResolver } from './subscription.widget';
import { ChartWidgetResolver } from './chart.widget';
import { TimelineWidgetResolver } from './timeline.widget';
import { SuggestCreateExpenseWidget } from './suggest-create-expense.widget';
import { SuggestUpdateExpenseWidget } from './suggest-update-expense.widget';
import { SuggestCreateEventWidget } from './suggest-create-event.widget';
import { SuggestUpdateEventWidget } from './suggest-update-event.widget';

@Injectable()
export class WidgetRegistry {
  private resolvers: Map<string, BaseWidgetResolver>;

  constructor(
    expense: ExpenseWidgetResolver,
    event: EventWidgetResolver,
    subscription: SubscriptionWidgetResolver,
    chart: ChartWidgetResolver,
    timeline: TimelineWidgetResolver,
    suggestCreateExpense: SuggestCreateExpenseWidget,
    suggestUpdateExpense: SuggestUpdateExpenseWidget,
    suggestCreateEvent: SuggestCreateEventWidget,
    suggestUpdateEvent: SuggestUpdateEventWidget,
  ) {
    this.resolvers = new Map(
      [expense, event, subscription, chart, timeline,
       suggestCreateExpense, suggestUpdateExpense, suggestCreateEvent, suggestUpdateEvent,
      ].map((r) => [r.type, r]),
    );
  }

  getCatalog(): string {
    return [...this.resolvers.values()]
      .filter((r) => !r.isFormWidget)
      .map((r) => `  ${r.type}: ${r.widgetDescription}`)
      .join('\n');
  }

  getFormWidgetDocs(): string {
    return [...this.resolvers.values()]
      .filter((r) => r.isFormWidget && r.widgetSchema)
      .map((r) => `  { "type": "${r.type}", "data": ${JSON.stringify(r.widgetSchema)} } — ${r.widgetDescription}`)
      .join('\n');
  }

  resolve(
    item: AiMessageItem,
    ctx: ToolContext,
    toolDataByName: Record<string, any>,
    skipValidation = false,
  ): Promise<AiChatMessageItem | null> | null {
    const resolver = this.resolvers.get(item.type);
    if (!resolver) return null;
    const liveData = toolDataByName[resolver.toolName ?? item.subtype ?? item.type];
    return resolver.resolve(item, ctx, liveData, skipValidation);
  }
}

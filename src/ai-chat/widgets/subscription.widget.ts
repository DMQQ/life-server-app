import { Injectable } from '@nestjs/common';
import { SubscriptionService } from 'src/wallet/services/subscriptions.service';
import { AiMessageItem } from 'src/utils/shared/AI/StatisticsChatQuery';
import { AiChatMessageItem } from '../ai-chat.schemas';
import { ToolContext } from '../tools/base.tool';
import { SubscriptionResource } from '../resources/subscription.resource';
import { BaseWidgetResolver } from './base.widget';

@Injectable()
export class SubscriptionWidgetResolver extends BaseWidgetResolver {
  readonly type = 'subscription';
  readonly toolName = 'subscriptions';
  readonly widgetDescription = 'Shows a fetched subscription card. Use after querying subscriptions tool — include one per returned record.';

  constructor(private subscriptionService: SubscriptionService) {
    super();
  }

  async resolve(item: AiMessageItem, ctx: ToolContext, liveData?: any, skipValidation = false): Promise<AiChatMessageItem | null> {
    if (!this.isValidId(item.id, liveData, skipValidation)) return null;
    const sub = await this.subscriptionService.getSubscriptionById(item.id!);
    return sub ? { type: 'subscription', subtype: null, data: JSON.stringify(SubscriptionResource.toWidgetPayload(sub)) } : null;
  }
}

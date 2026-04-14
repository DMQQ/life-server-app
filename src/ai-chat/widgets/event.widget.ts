import { Injectable } from '@nestjs/common';
import { EventOccurrenceService } from 'src/timeline/event-occurrence.service';

import { AiMessageItem } from 'src/utils/shared/AI/StatisticsChatQuery';
import { AiChatMessageItem } from '../ai-chat.schemas';
import { ToolContext } from '../tools/base.tool';
import { EventResource } from '../resources/event.resource';
import { BaseWidgetResolver } from './base.widget';

@Injectable()
export class EventWidgetResolver extends BaseWidgetResolver {
  readonly type = 'event';
  readonly toolName = 'events';
  readonly widgetDescription = 'Shows a fetched calendar event card. Use after querying events tool — include one per returned record.';

  constructor(private occurrenceService: EventOccurrenceService) {
    super();
  }

  async resolve(item: AiMessageItem, ctx: ToolContext, liveData?: any, skipValidation = false): Promise<AiChatMessageItem | null> {
    if (!this.isValidId(item.id, liveData, skipValidation)) return null;
    const event = await this.occurrenceService.findById(item.id, ctx.userId);
    return event ? { type: 'event', subtype: null, data: JSON.stringify(EventResource.toWidgetPayload(event)) } : null;
  }
}

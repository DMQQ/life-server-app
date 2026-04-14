import { Injectable } from '@nestjs/common';
import { AiMessageItem } from 'src/utils/shared/AI/StatisticsChatQuery';
import { AiChatMessageItem } from '../ai-chat.schemas';
import { ToolContext } from '../tools/base.tool';
import { BaseWidgetResolver } from './base.widget';

@Injectable()
export class SuggestUpdateEventWidget extends BaseWidgetResolver {
  readonly type = 'form_event_edit';
  readonly isFormWidget = true;
  readonly widgetDescription = 'Blueprint for editing an existing calendar event. Use when user wants to reschedule or modify an event — requires the event id from a previous query.';
  readonly widgetSchema = {
    id: 'string UUID (required)',
    title: 'string (optional)',
    date: 'YYYY-MM-DD (optional)',
    beginTime: 'HH:mm (optional)',
    endTime: 'HH:mm (optional)',
    description: 'string (optional)',
    isCompleted: 'boolean (optional)',
  };

  async resolve(item: AiMessageItem, _ctx: ToolContext): Promise<AiChatMessageItem | null> {
    if (!item.data) return null;
    return { type: this.type, subtype: null, data: JSON.stringify(item.data) };
  }
}

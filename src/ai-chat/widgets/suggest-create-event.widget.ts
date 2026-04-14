import { Injectable } from '@nestjs/common';
import { AiMessageItem } from 'src/utils/shared/AI/StatisticsChatQuery';
import { AiChatMessageItem } from '../ai-chat.schemas';
import { ToolContext } from '../tools/base.tool';
import { BaseWidgetResolver } from './base.widget';

@Injectable()
export class SuggestCreateEventWidget extends BaseWidgetResolver {
  readonly type = 'form_event_new';
  readonly isFormWidget = true;
  readonly widgetDescription = 'Blueprint for creating a new calendar event. Use when user wants to schedule something — AI fills the fields, user confirms.';
  readonly widgetSchema = {
    title: 'string (required)',
    date: 'YYYY-MM-DD (required)',
    beginTime: 'HH:mm (optional)',
    endTime: 'HH:mm (optional)',
    description: 'string (optional)',
    isAllDay: 'boolean (optional, default false)',
    tags: 'string (optional)',
  };

  async resolve(item: AiMessageItem, _ctx: ToolContext): Promise<AiChatMessageItem | null> {
    if (!item.data) return null;
    return { type: this.type, subtype: null, data: JSON.stringify(item.data) };
  }
}

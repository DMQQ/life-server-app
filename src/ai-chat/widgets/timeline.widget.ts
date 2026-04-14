import { Injectable } from '@nestjs/common';
import { AiMessageItem } from 'src/utils/shared/AI/StatisticsChatQuery';
import { AiChatMessageItem } from '../ai-chat.schemas';
import { ToolContext } from '../tools/base.tool';
import { BaseWidgetResolver } from './base.widget';

@Injectable()
export class TimelineWidgetResolver extends BaseWidgetResolver {
  readonly type = 'timelineWidget';
  readonly widgetDescription = 'Shows parsed events/tasks extracted from free text. Use only after timelineWidget tool.';

  async resolve(item: AiMessageItem, _ctx: ToolContext, toolDataByName: Record<string, any> = {}): Promise<AiChatMessageItem | null> {
    const liveData = toolDataByName['timelineWidget'];
    const raw = liveData ? JSON.stringify(liveData) : (item as any).data;
    return raw ? { type: 'timelineWidget', subtype: null, data: raw } : null;
  }
}

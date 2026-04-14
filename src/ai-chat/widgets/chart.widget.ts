import { Injectable } from '@nestjs/common';
import { AiMessageItem } from 'src/utils/shared/AI/StatisticsChatQuery';
import { AiChatMessageItem } from '../ai-chat.schemas';
import { ToolContext } from '../tools/base.tool';
import { ALL_TOOLS } from '../tools';
import { BaseWidgetResolver } from './base.widget';

@Injectable()
export class ChartWidgetResolver extends BaseWidgetResolver {
  readonly type = 'chart';
  readonly widgetDescription = 'Shows a data chart. Use after querying a stats tool (legend, dailySpendings, etc.) — subtype must match the tool name.';

  async resolve(item: AiMessageItem, ctx: ToolContext, liveData?: any): Promise<AiChatMessageItem | null> {
    if (liveData) {
      return { type: 'chart', subtype: item.subtype ?? null, data: JSON.stringify(liveData) };
    }

    const storedParams = (item as any).toolParams;
    const toolInstance = ALL_TOOLS.find((t) => t.name === item.subtype);
    if (toolInstance && storedParams) {
      const data = toolInstance.normalize(await toolInstance.run(storedParams, ctx));
      return data ? { type: 'chart', subtype: item.subtype ?? null, data: JSON.stringify(data) } : null;
    }

    return null;
  }
}

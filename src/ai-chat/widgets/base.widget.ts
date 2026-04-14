import { AiMessageItem } from 'src/utils/shared/AI/StatisticsChatQuery';
import { AiChatMessageItem } from '../ai-chat.schemas';
import { ToolContext } from '../tools/base.tool';

export abstract class BaseWidgetResolver {
  abstract readonly type: string;
  readonly toolName?: string;

  abstract readonly widgetDescription: string;
  readonly widgetSchema?: Record<string, string>;
  readonly isFormWidget: boolean = false;

  abstract resolve(
    item: AiMessageItem,
    ctx: ToolContext,
    liveData?: any,
    skipValidation?: boolean,
  ): Promise<AiChatMessageItem | null>;

  protected isValidId(id: string | undefined, liveData: any, skipValidation: boolean): boolean {
    if (!id) return false;
    if (skipValidation) return true;
    if (!Array.isArray(liveData)) return false;
    return liveData.some((r: any) => r.id === id);
  }
}

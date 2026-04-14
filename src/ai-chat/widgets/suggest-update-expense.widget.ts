import { Injectable } from '@nestjs/common';
import { AiMessageItem } from 'src/utils/shared/AI/StatisticsChatQuery';
import { AiChatMessageItem } from '../ai-chat.schemas';
import { ToolContext } from '../tools/base.tool';
import { BaseWidgetResolver } from './base.widget';
import { EXPENSE_CATEGORIES } from 'src/utils/shared/AI/constants';

@Injectable()
export class SuggestUpdateExpenseWidget extends BaseWidgetResolver {
  readonly type = 'form_expense_edit';
  readonly isFormWidget = true;
  readonly widgetDescription = `Blueprint for editing an existing expense. Use when user wants to change a transaction they already made — requires the expense id from a previous query., expense categories: ${EXPENSE_CATEGORIES}`;
  readonly widgetSchema = {
    id: 'string UUID (required)',
    amount: 'number (required) - new amount for the expense or old if amount not changing',
    description: 'string (required), Pass previous description if not changing',
    date: 'YYYY-MM-DD (required)',
    category: `string (required, one of the predefined categories) ${EXPENSE_CATEGORIES}`,
    shop: 'string (optional)',
  };

  async resolve(item: AiMessageItem, _ctx: ToolContext): Promise<AiChatMessageItem | null> {
    if (!item.data) return null;
    return { type: this.type, subtype: null, data: JSON.stringify(item.data) };
  }
}

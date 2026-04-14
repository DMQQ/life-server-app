import { Injectable } from '@nestjs/common';
import { AiMessageItem } from 'src/utils/shared/AI/StatisticsChatQuery';
import { AiChatMessageItem } from '../ai-chat.schemas';
import { ToolContext } from '../tools/base.tool';
import { BaseWidgetResolver } from './base.widget';
import { EXPENSE_CATEGORIES } from 'src/utils/shared/AI/constants';

@Injectable()
export class SuggestCreateExpenseWidget extends BaseWidgetResolver {
  readonly type = 'form_expense_new';
  readonly isFormWidget = true;
  readonly widgetDescription =
    'Blueprint for creating a new expense/income. Use when user wants to add a transaction — AI fills the fields, user confirms.';
  readonly widgetSchema = {
    amount: 'number (PLN, required)',
    description: 'string (required)',
    date: 'YYYY-MM-DD (required)',
    type: '"expense" | "income" (required)',
    category: `string e.g. ${EXPENSE_CATEGORIES} (required)`,
    shop: 'string (optional)',
  };

  async resolve(item: AiMessageItem, _ctx: ToolContext): Promise<AiChatMessageItem | null> {
    if (!item.data) return null;
    return { type: this.type, subtype: null, data: JSON.stringify(item.data) };
  }
}

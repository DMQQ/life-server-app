import { Injectable } from '@nestjs/common';
import { ExpenseService } from 'src/wallet/services/expense.service';
import { AiMessageItem } from 'src/utils/shared/AI/StatisticsChatQuery';
import { AiChatMessageItem } from '../ai-chat.schemas';
import { ToolContext } from '../tools/base.tool';
import { ExpenseResource } from '../resources/expense.resource';
import { BaseWidgetResolver } from './base.widget';

@Injectable()
export class ExpenseWidgetResolver extends BaseWidgetResolver {
  readonly type = 'expense';
  readonly toolName = 'expenses';
  readonly widgetDescription = 'Shows a fetched expense/income card. Use after querying expenses tool — include one per returned record.';

  constructor(private expenseService: ExpenseService) {
    super();
  }

  async resolve(item: AiMessageItem, ctx: ToolContext, liveData?: any, skipValidation = false): Promise<AiChatMessageItem | null> {
    if (!this.isValidId(item.id, liveData, skipValidation)) return null;
    const expense = await this.expenseService.getOne(item.id!);
    return expense ? { type: 'expense', subtype: null, data: JSON.stringify(ExpenseResource.toWidgetPayload(expense)) } : null;
  }
}

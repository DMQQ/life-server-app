import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { encode } from '@toon-format/toon';
import { OpenAIService } from 'src/utils/services/OpenAI/openai.service';
import { StatisticsChatQuery, AiMessageItem, StatisticsChatOutput } from 'src/utils/shared/AI/StatisticsChatQuery';
import { AiChatHistoryEntity, AiMessageRaw } from './ai-chat-history.entity';
import { AiChatMessageItem } from './ai-chat.schemas';
import { ALL_TOOLS, ToolContext, UniversalQueryParams } from './tools';
import { ExpenseService } from 'src/wallet/services/expense.service';
import { EventOccurrenceService } from 'src/timeline/event-occurrence.service';
import { SubscriptionService } from 'src/wallet/services/subscriptions.service';

class Conversation {
  private messages: { role: 'user' | 'assistant'; content: string }[] = [];
  private toolCallCount = 0;

  constructor(initialMessages?: { role: 'user' | 'assistant'; content: string }[]) {
    if (initialMessages) {
      this.messages.push(...initialMessages);
    }
  }

  initializeWithHistory(history?: { role: 'user' | 'assistant'; content: string }[]) {
    if (history) {
      this.messages.push(...history);
    }
  }

  incrementToolCall() {
    this.toolCallCount++;
  }

  getToolCallCount() {
    return this.toolCallCount;
  }

  addUserMessage(content: string) {
    this.messages.push({ role: 'user', content });
  }

  addAssistantMessage(content: string) {
    this.messages.push({ role: 'assistant', content });
  }

  getMessages() {
    return this.messages;
  }

  end() {
    this.messages.push({
      role: 'user',
      content: 'Maximum tool calls reached. Provide your final answer using the data collected.',
    });
  }

  getTool(name: string) {
    return [...ALL_TOOLS].find((t) => t.name === name);
  }
}

const MAX_TOOL_CALLS = 4;

@Injectable()
export class AiChatService {
  constructor(
    private openAIService: OpenAIService,
    private dataSource: DataSource,
    @InjectRepository(AiChatHistoryEntity)
    private historyRepository: Repository<AiChatHistoryEntity>,

    private expenseService: ExpenseService,

    private occurenceService: EventOccurrenceService,

    private subscriptionService: SubscriptionService,
  ) {}

  private makeContext(userId: string, walletId?: string): ToolContext {
    return { userId, walletId, dataSource: this.dataSource, openAIService: this.openAIService };
  }

  private async resolveMessages(
    rawMessages: AiMessageItem[],
    toolDataByName: Record<string, any>,
    skipValidation = false,
    context: { userId: string; walletId?: string },
  ): Promise<AiChatMessageItem[]> {
    const validIds: Record<'expense' | 'subscription' | 'event', Set<string>> = {
      expense: new Set(),
      subscription: new Set(),
      event: new Set(),
    };

    if (!skipValidation) {
      for (const [toolName, data] of Object.entries(toolDataByName)) {
        if (!Array.isArray(data)) continue;
        const ids = data.map((r: any) => r.id).filter(Boolean);
        if (toolName === 'expenses') ids.forEach((id) => validIds.expense.add(id));
        if (toolName === 'subscriptions') ids.forEach((id) => validIds.subscription.add(id));
        if (toolName === 'events') ids.forEach((id) => validIds.event.add(id));
      }
    }

    const isValid = (type: 'expense' | 'subscription' | 'event', id?: string) =>
      id && (skipValidation || validIds[type].has(id));

    const resolved = await Promise.all(
      rawMessages.map(async (item): Promise<any | null> => {
        if (item.type === 'text') {
          return { type: 'text', subtype: null, data: item.content };
        }

        if (item.type === 'chart') {
          const raw = toolDataByName[item.subtype];
          const chartData = (item as any).chartData ?? (raw ? JSON.stringify(raw) : undefined);
          return chartData ? { type: 'chart', subtype: item.subtype, data: JSON.stringify(chartData) } : null;
        }

        if (item.type === 'expense' && isValid('expense', item.id)) {
          const expense = await this.expenseService.getOne(item.id!);
          return expense ? { type: 'expense', subtype: null, data: JSON.stringify(expense) } : null;
        }

        if (item.type === 'subscription' && isValid('subscription', item.id)) {
          const subscription = await this.subscriptionService.getSubscriptionById(item.id!);
          return subscription ? { type: 'subscription', subtype: null, data: JSON.stringify(subscription) } : null;
        }

        if (item.type === 'event' && isValid('event', item.id)) {
          const event = await this.occurenceService.findById(item.id, context.userId);
          return event ? { type: 'event', subtype: null, data: JSON.stringify(event) } : null;
        }

        if (item.type === 'timelineWidget') {
          const raw = toolDataByName['timelineWidget'] ?? (item as any).data;
          return raw ? { type: 'timelineWidget', subtype: null, data: typeof raw === 'string' ? raw : JSON.stringify(raw) } : null;
        }

        return null;
      }),
    );

    return resolved.filter(Boolean) as AiChatMessageItem[];
  }

  async getHistory(userId: string) {
    const history = await this.historyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return Promise.all(
      history.map(async (item) => ({
        ...item,
        messages: await this.resolveMessages(item.aiMessages ?? [], {}, true, { userId }),
      })),
    );
  }

  async chat(params: {
    userId: string;
    walletId?: string;
    message: string;
    startDate?: string;
    endDate?: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }) {
    const { userId, walletId, message, startDate, endDate, history } = params;
    const ctx = this.makeContext(userId, walletId);
    const dateContext = { startDate, endDate };

    const conversation = new Conversation();
    conversation.initializeWithHistory(history);
    conversation.addUserMessage(message);

    const toolDataByName: Record<string, any> = {};
    let finalOutput: StatisticsChatOutput;

    while (true) {
      finalOutput = await this.openAIService.execute(new StatisticsChatQuery(), {
        tools: ALL_TOOLS,
        dateContext,
        conversation: conversation.getMessages(),
      });

      if (finalOutput.action !== 'tool_call') {
        break;
      }

      if (conversation.getToolCallCount() >= MAX_TOOL_CALLS) {
        break;
      }

      const { action, tool: toolName, ...toolParams } = finalOutput as any;
      const toolInstance = conversation.getTool(toolName);

      if (!toolInstance) break;

      conversation.addAssistantMessage(JSON.stringify(finalOutput));

      const normalizedData = toolInstance.normalize(await toolInstance.run(toolParams as UniversalQueryParams, ctx));

      toolDataByName[toolName] = normalizedData;

      conversation.addUserMessage(`[TOOL: ${toolName}]\n${encode(normalizedData)}`);
      conversation.incrementToolCall();

      if (conversation.getToolCallCount() === MAX_TOOL_CALLS) {
        conversation.end();
      }
    }

    const rawMessages = (finalOutput.messages ?? []) as AiMessageItem[];
    const resolvedMessages = await this.resolveMessages(rawMessages, toolDataByName, false, ctx);

    const toStore: AiMessageRaw[] = rawMessages.map((item) => {
      if (item.type === 'chart' && toolDataByName[item.subtype])
        return { ...item, chartData: JSON.stringify(toolDataByName[item.subtype]) };
      if (item.type === 'timelineWidget' && toolDataByName['timelineWidget'])
        return { ...item, data: JSON.stringify(toolDataByName['timelineWidget']) } as AiMessageRaw;
      return item as AiMessageRaw;
    });

    this.historyRepository.save({
      userId,
      userMessage: message,
      aiMessages: toStore,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    });

    return { messages: resolvedMessages };
  }
}

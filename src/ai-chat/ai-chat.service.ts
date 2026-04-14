import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { encode } from '@toon-format/toon';
import { OpenAIService } from 'src/utils/services/OpenAI/openai.service';
import { StatisticsChatQuery, AiMessageItem, StatisticsChatOutput } from 'src/utils/shared/AI/StatisticsChatQuery';
import { AnswerGenerationQuery } from 'src/utils/shared/AI/AnswerGenerationQuery';
import { AiChatHistoryEntity, AiMessageRaw } from './ai-chat-history.entity';
import { AiChatMessageItem } from './ai-chat.schemas';
import { ALL_TOOLS, ToolContext, UniversalQueryParams, ZodError } from './tools';
import { WidgetRegistry } from './widgets/widget.registry';

type ConversationMessage = { role: 'user' | 'assistant'; content: string };

interface AgentLoopResult {
  finalOutput: StatisticsChatOutput;
  toolDataByName: Record<string, any>;
  toolParamsByName: Record<string, any>;
}

export interface ChatParams {
  userId: string;
  walletId?: string;
  message: string;
  startDate?: string;
  endDate?: string;
  history?: ConversationMessage[];
}

class Conversation {
  private messages: ConversationMessage[] = [];
  private toolCallCount = 0;

  constructor(history: ConversationMessage[] = []) {
    this.messages.push(...history);
  }

  add(role: 'user' | 'assistant', content: string) {
    this.messages.push({ role, content });
  }

  getMessages() {
    return this.messages;
  }

  incrementToolCall() {
    this.toolCallCount++;
    if (this.toolCallCount === MAX_TOOL_CALLS) {
      this.add('user', 'Maximum tool calls reached. Provide your final answer using the data collected.');
    }
  }

  isExhausted() {
    return this.toolCallCount >= MAX_TOOL_CALLS;
  }

  findTool(name: string) {
    return ALL_TOOLS.find((t) => t.name === name);
  }
}

const MAX_TOOL_CALLS = 8;

@Injectable()
export class AiChatService {
  constructor(
    private openAIService: OpenAIService,
    private dataSource: DataSource,
    @InjectRepository(AiChatHistoryEntity)
    private historyRepository: Repository<AiChatHistoryEntity>,
    private widgetRegistry: WidgetRegistry,
  ) {}

  private makeContext(userId: string, walletId?: string): ToolContext {
    return { userId, walletId, dataSource: this.dataSource, openAIService: this.openAIService };
  }

  private async runAgentLoop(
    conversation: Conversation,
    ctx: ToolContext,
    dateContext: { startDate?: string; endDate?: string },
    recentMessages: string[] = [],
  ): Promise<AgentLoopResult> {
    const toolDataByName: Record<string, any> = {};
    const toolParamsByName: Record<string, any> = {};
    let finalOutput: StatisticsChatOutput;

    while (true) {
      finalOutput = await this.openAIService.execute(new StatisticsChatQuery(), {
        tools: ALL_TOOLS,
        widgetCatalog: this.widgetRegistry.getCatalog(),
        formWidgetDocs: this.widgetRegistry.getFormWidgetDocs(),
        dateContext,
        conversation: conversation.getMessages(),
        recentMessages,
      });

      const isToolCall = finalOutput.action === 'tool_call' && !!(finalOutput as any).tool;
      if (!isToolCall || conversation.isExhausted()) break;

      const { tool: toolName, ...toolParams } = finalOutput as any;
      const toolInstance = conversation.findTool(toolName);
      if (!toolInstance) break;

      conversation.add('assistant', JSON.stringify(finalOutput));

      try {
        const safeParams = toolInstance.validateParams(toolParams);
        const data = toolInstance.normalize(await toolInstance.run(safeParams as UniversalQueryParams, ctx));
        toolDataByName[toolName] = data;
        toolParamsByName[toolName] = safeParams;
        conversation.add('user', `[TOOL: ${toolName}]\n${encode(data)}`);
      } catch (error) {
        const msg =
          error instanceof ZodError
            ? `[TOOL_ERROR: ${toolName}] Invalid params: ${error.errors.map((e) => e.message).join(', ')}.`
            : `[TOOL_ERROR: ${toolName}] ${(error as Error).message}.`;
        conversation.add('user', msg + ' Fix parameters and retry.');
      }

      conversation.incrementToolCall();
    }

    return { finalOutput, toolDataByName, toolParamsByName };
  }

  private async rewriteWithPersonality(
    userMessage: string,
    rawMessages: AiMessageItem[],
    toolDataByName: Record<string, any>,
    recentMessages: string[] = [],
  ): Promise<AiMessageItem[]> {
    const textItems = rawMessages.filter((m) => m.type === 'text').map((m) => m.content ?? '');
    if (!textItems.length) return rawMessages;

    try {
      const collectedData = Object.entries(toolDataByName)
        .map(([name, data]) => `${name}: ${JSON.stringify(Array.isArray(data) ? data.slice(0, 5) : data)}`)
        .join('\n');

      const rewritten = await this.openAIService.execute(new AnswerGenerationQuery(), {
        userMessage,
        collectedData,
        rawTextMessages: textItems,
        recentMessages,
      });

      const queue = [rewritten];
      return rawMessages.map((m) => (m.type === 'text' ? { ...m, content: queue.shift() ?? m.content } : m));
    } catch {
      return rawMessages;
    }
  }

  private buildStoragePayload(
    rawMessages: AiMessageItem[],
    toolDataByName: Record<string, any>,
    toolParamsByName: Record<string, any>,
  ): AiMessageRaw[] {
    return rawMessages.map((item) => {
      if (item.type === 'chart' && toolParamsByName[item.subtype])
        return { ...item, toolParams: toolParamsByName[item.subtype] } as AiMessageRaw;
      if (item.type === 'timelineWidget' && toolDataByName['timelineWidget'])
        return { ...item, data: JSON.stringify(toolDataByName['timelineWidget']) } as AiMessageRaw;
      return item as AiMessageRaw;
    });
  }

  private async resolveMessages(
    rawMessages: AiMessageItem[],
    ctx: ToolContext,
    toolDataByName: Record<string, any> = {},
    skipValidation = false,
  ): Promise<AiChatMessageItem[]> {
    const resolved = await Promise.all(
      rawMessages.map(async (item): Promise<AiChatMessageItem | null> => {
        if (item.type === 'text') return { type: 'text', subtype: null, data: item.content };
        return this.widgetRegistry.resolve(item, ctx, toolDataByName, skipValidation);
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
        messages: await this.resolveMessages(item.aiMessages ?? [], this.makeContext(userId, item.walletId), {}, true),
      })),
    );
  }

  private async fetchRecentMessages(userId: string): Promise<string[]> {
    const rows = await this.historyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 10,
      select: ['userMessage'],
    });
    return rows.map((r) => r.userMessage).reverse();
  }

  async chat({ userId, walletId, message, startDate, endDate, history }: ChatParams) {
    const ctx = this.makeContext(userId, walletId);
    const conversation = new Conversation(history);
    conversation.add('user', message);

    const recentMessages = await this.fetchRecentMessages(userId);

    const { finalOutput, toolDataByName, toolParamsByName } = await this.runAgentLoop(
      conversation,
      ctx,
      { startDate, endDate },
      recentMessages,
    );

    const rawMessages = (finalOutput.messages ?? []) as AiMessageItem[];
    console.log('[AI] finalOutput.action:', finalOutput.action);
    console.log('[AI] rawMessages:', JSON.stringify(rawMessages));
    console.log('[AI] toolDataByName keys:', Object.keys(toolDataByName));

    const finalMessages = await this.rewriteWithPersonality(message, rawMessages, toolDataByName, recentMessages);
    const resolvedMessages = await this.resolveMessages(finalMessages, ctx, toolDataByName);
    console.log('[AI] resolvedMessages:', JSON.stringify(resolvedMessages));

    this.historyRepository.save({
      userId,
      walletId: walletId ?? null,
      userMessage: message,
      aiMessages: this.buildStoragePayload(rawMessages, toolDataByName, toolParamsByName),
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    });

    return { messages: resolvedMessages };
  }
}

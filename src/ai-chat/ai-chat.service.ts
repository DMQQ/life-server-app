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
import { Agent, run } from '@openai/agents';
import * as z from 'zod';
import * as dayjs from 'dayjs';

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
    return { userId, walletId, dataSource: this.dataSource, openAIService: this.openAIService, toolDataCache: {} };
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
            ? `[TOOL_ERROR: ${toolName}] Invalid params: ${(error as z.ZodError).issues.map((e) => e.message).join(', ')}.`
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

    const finalMessages = await this.rewriteWithPersonality(message, rawMessages, toolDataByName, recentMessages);
    const resolvedMessages = await this.resolveMessages(finalMessages, ctx, toolDataByName);

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

  async agentChat({ userId, walletId, message }: ChatParams) {
    const ctx = this.makeContext(userId, walletId);

    const dbHistory = await this.historyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 5, // Just need recent context
    });

    const mappedHistory = dbHistory.reverse().flatMap((row) => [
      { role: 'user', content: row.userMessage },
      { role: 'assistant', content: JSON.stringify(row.aiMessages) },
    ]);

    const displayWidgets = this.widgetRegistry.getCatalog();
    const formWidgets = this.widgetRegistry.getFormWidgetDocs();

    const today = dayjs().format('YYYY-MM-DD HH:mm:ss');

    const lifeAssistant = new Agent({
      name: 'LifeAssistant',
      model: 'gpt-4o-mini',
      instructions: `You are a personal life assistant. Respond in Polish. Currency is PLN.
CURRENT DATE: ${today}. Use this as reference for relative dates: "dzisiaj"=${today}, "wczoraj"=yesterday, "w tym miesiącu"=current month.

DATE QUERY RULES (CRITICAL):
- For "last/most recent" queries (ostatni, najnowszy, ostatnie): use orderBy date DESC, limit 1, NO date filter.
- For "today" queries: use date between "${today} 00:00:00" and "${today} 23:59:59".
- For "this month": use date between first and last day of current month.
- For "this week": use date between last Monday and next Sunday.
- For explicit date ranges (e.g. "from 2024-01-01 to 2024-01-31"): use those exact dates as filters.
- NEVER apply a date filter when the user asks for the most recent item — they want ALL TIME most recent.

INTENT ROUTING (decide first, then act — no exceptions):
- CREATE / ADD / EDIT / DELETE intent → immediately output the form widget. DO NOT call any tools first.
- READ / SHOW / FETCH / SUMMARIZE intent → call the appropriate tool(s), then output widgets with the results.

FORM WIDGETS (use for create/edit — fill fields from user input, user confirms):
${formWidgets}

DISPLAY WIDGETS (use after fetching data):
${displayWidgets}

CRITICAL OUTPUT RULE: Your final output MUST be a strict JSON array of UI widgets. NEVER output plain markdown text.
Even if a tool returns an error or empty data, wrap your response in the JSON array.

1. NEVER describe fetched items in text. Every fetched record MUST appear as a card using its ID.
2. Text is ONLY for summaries or context — never for listing individual records.
3. If a tool returns empty data, output: [{"type": "text", "content": "Brak danych za ten okres."}]`,
      tools: ALL_TOOLS.map((t) => t.getToolDefinition(ctx)),
    });

    const result = await run(lifeAssistant, message, {
      context: mappedHistory as any,
    });

    let rawMessages: AiMessageItem[] = [];
    try {
      const parsed = JSON.parse(result.finalOutput);
      rawMessages = Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      console.error('[AI Agent] Failed to parse JSON widgets:', result.finalOutput);
      rawMessages = [{ type: 'text', content: result.finalOutput }];
    }

    const recentMessages = await this.fetchRecentMessages(userId);
    const finalMessages = await this.rewriteWithPersonality(message, rawMessages, ctx.toolDataCache, recentMessages);
    const resolvedMessages = await this.resolveMessages(finalMessages, ctx, ctx.toolDataCache);

    await this.historyRepository.save({
      userId,
      walletId: walletId ?? null,
      userMessage: message,
      aiMessages: rawMessages as AiMessageRaw[],
    });

    return { messages: resolvedMessages };
  }
}

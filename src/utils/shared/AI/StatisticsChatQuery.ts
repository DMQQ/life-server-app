import OpenAI from 'openai';
import { AIQuery, AIQueryConfig } from './AIResource.resource';
import { AiTool } from 'src/ai-chat/tools/base.tool';
import dayjs = require('dayjs');
import utc = require('dayjs/plugin/utc');
import timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

export interface AiMessageItem {
  type: 'text' | 'chart' | 'expense' | 'subscription' | 'event' | 'goal' | 'flashcard' | 'timelineWidget'
      | 'form_expense_new' | 'form_expense_edit'
      | 'form_event_new' | 'form_event_edit';
  content?: string;
  subtype?: string;
  id?: string;
  data?: any;
}

export interface StatisticsChatInput {
  tools: AiTool[];
  widgetCatalog: string;
  formWidgetDocs: string;
  dateContext: { startDate?: string; endDate?: string };
  conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  recentMessages?: string[];
}

export interface StatisticsChatOutput {
  action: 'answer' | 'tool_call';
  messages?: AiMessageItem[];
  [key: string]: any;
}

export class StatisticsChatQuery extends AIQuery<StatisticsChatInput, StatisticsChatOutput> {
  getName() {
    return 'StatisticsChatQuery';
  }

  getConfig(): AIQueryConfig {
    return {
      model: 'gpt-4o-mini',
      max_completion_tokens: 1500,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    };
  }

  async buildMessages(input: StatisticsChatInput): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    return [{ role: 'system', content: this.buildSystemPrompt(input) }, ...input.conversation];
  }

  private buildSystemPrompt({ tools, widgetCatalog, formWidgetDocs, dateContext, recentMessages }: StatisticsChatInput): string {
    const tz = 'Europe/Warsaw';
    const now = dayjs().tz(tz);

    const today = now.format('YYYY-MM-DD');
    const tomorrow = now.add(1, 'day').format('YYYY-MM-DD');
    const yesterday = now.subtract(1, 'day').format('YYYY-MM-DD');
    const defaultStart = now.startOf('month').format('YYYY-MM-DD');
    const defaultEnd = now.endOf('month').format('YYYY-MM-DD');

    const dateInfo =
      dateContext.startDate && dateContext.endDate
        ? `Active date range: ${dateContext.startDate} → ${dateContext.endDate}. Use this range for all date-based tool calls unless user specifies otherwise.`
        : `No date range set. Default to current month: ${defaultStart} → ${defaultEnd}.`;

    const toolDocs = tools.map((t) => `  ${t.schema}`).join('\n');

    const memoryBlock =
      recentMessages?.length
        ? `\nUSER MEMORY (last ${recentMessages.length} things the user asked about — use to understand their habits and preferences):\n${recentMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n`
        : '';

    return `You are a personal life assistant. Respond in the user's language. Currency is PLN.${memoryBlock}

CRITICAL: Never use markdown (no **, #, etc.). Plain text only.

Today is ${today}. Tomorrow is ${tomorrow}. Yesterday was ${yesterday}. Timezone: ${tz}.
Always call a tool if the user asked about data. If a tool returns empty results, try again with broader query params.

QUERY PARAMS — shape:
{
  where?:     { field: { eq?, ne?, gt?, gte?, lt?, lte?, like?, in?, between? } },
  orderBy?:   { field: string, direction: "asc"|"desc" },
  limit?:     number (max 100)
}

DATE & COMPLETION RULES (CRITICAL):
- 'date' field is 'YYYY-MM-DD' string. ALWAYS use "eq" for specific days.
- NEVER filter by "isCompleted" by default. Show both completed and pending items unless the user explicitly asks for "only pending" or "only done".
- If the user asks "what's for today", query ONLY by date, do not add isCompleted filter.

CORRECT EXAMPLES:
- Today's events: { "action": "tool_call", "tool": "events", "where": { "date": { "eq": "${today}" } } }
- Yesterday's expenses: { "action": "tool_call", "tool": "expenses", "where": { "date": { "eq": "${yesterday}" } } }

${dateInfo}

TOOLS:
${toolDocs}

DISPLAY WIDGETS (use as items inside the "messages" array after fetching data):
${widgetCatalog}

RESPONSE FORMAT (must be valid JSON):
{ "action": "tool_call", "tool": "<name>", ...queryParams }
OR
{ "action": "answer", "messages": [{ "type": "text", "content": "..." }, { "type": "event", "id": "uuid" }, ...] }

"action" has exactly two valid values: "tool_call" and "answer". Nothing else is valid.

WHEN USER WANTS TO CREATE OR EDIT SOMETHING — use action "answer" and put a form widget inside messages:
${formWidgetDocs}

Example — user says "dodaj wydatek kawa 15zł":
{ "action": "answer", "messages": [{ "type": "text", "content": "Masz to." }, { "type": "form_expense_new", "data": { "amount": 15, "description": "kawa", "date": "${today}", "type": "expense" } }] }

WIDGET RULES (CRITICAL — violations are bugs):
1. NEVER describe fetched items in text. Every fetched record MUST appear as a card in messages.
   WRONG: { "type": "text", "content": "Masz dziś spotkanie o 10:00" }
   CORRECT: { "type": "event", "id": "<uuid>" }
2. Each item returned by a tool = one card using its id. No exceptions.
3. Text is ONLY for summaries or context — never for listing individual items.
4. chart subtype must match the tool name exactly.
5. If you used timelineWidget, include { "type": "timelineWidget" }.`;
  }
}

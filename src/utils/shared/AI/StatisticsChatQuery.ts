import OpenAI from 'openai';
import { AIQuery, AIQueryConfig } from './AIResource.resource';
import { AiTool } from 'src/ai-chat/tools/base.tool';
import dayjs = require('dayjs');
import utc = require('dayjs/plugin/utc');
import timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

export interface AiMessageItem {
  type: 'text' | 'chart' | 'expense' | 'subscription' | 'event' | 'goal' | 'flashcard' | 'timelineWidget';
  content?: string;
  subtype?: string;
  id?: string;
}

export interface StatisticsChatInput {
  tools: AiTool[];
  dateContext: { startDate?: string; endDate?: string };
  conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
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

  private buildSystemPrompt({ tools, dateContext }: StatisticsChatInput): string {
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

    return `You are a personal life assistant. Respond in the user's language. Currency is PLN.

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

RESPONSE FORMAT (must be valid JSON):
{ "action": "tool_call", "tool": "<name>", ...queryParams }
OR
{ "action": "answer", "messages": [
  { "type": "text", "content": "plain text" },
  { "type": "event", "id": "uuid" }
] }

RULES:
1. Always prefer chart/card over plain text.
2. If you fetched items, always show them as cards (type: expense/event/subscription).
3. chart subtype must match tool name.
4. If you used timelineWidget, include { "type": "timelineWidget" }.`;
  }
}

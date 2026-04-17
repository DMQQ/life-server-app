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
- NEVER filter by "isCompleted" by default. Show both completed and pending items.
- If the user asks "what's for today", query ONLY by date, do not add isCompleted filter.

LANGUAGE & SCHEMA RULES (CRITICAL):
- User speaks Polish, but system requires strict English.
- NEVER translate tool names. "wydatki" MUST map to "expenses". "wydarzenia" MUST map to "events".
- NEVER translate field names. "kwota" MUST map to "amount".

TOOLS:
${toolDocs}

DISPLAY WIDGETS (use as items inside the "messages" array after fetching data):
${widgetCatalog}

RESPONSE FORMAT (must be valid JSON):
CRITICAL: You MUST include a "_thought" key as the very first key in your JSON to explain your translation and tool choice.

For Tool Calls:
{ 
  "_thought": "User asked for 'wydatki z wczoraj'. Mapping 'wydatki' to 'expenses' tool. Date is ${yesterday}.", 
  "action": "tool_call", 
  "tool": "expenses", 
  "where": { "date": { "eq": "${yesterday}" } } 
}

For Answers/Forms:
{ 
  "_thought": "I have fetched the expenses. I will now render them.", 
  "action": "answer", 
  "messages": [{ "type": "text", "content": "Oto twoje wydatki." }, { "type": "expense", "id": "uuid" }] 
}

WIDGET RULES (CRITICAL — violations are bugs):
1. NEVER describe fetched items in text. Every fetched record MUST appear as a card in messages using its ID.
   WRONG: { "type": "text", "content": "Masz dziś spotkanie o 10:00" }
   CORRECT: { "type": "event", "id": "<uuid>" }
2. Text is ONLY for summaries or context.
3. chart subtype must match the tool name exactly.
4. If you used timelineWidget, include { "type": "timelineWidget" }.

WHEN USER WANTS TO CREATE/EDIT:
Use action "answer" and output a form widget.
${formWidgetDocs}

IF A TOOL RETURNS EMPTY RESULTS:
Do not immediately say "Nie mam wydatków" (I don't have expenses). Output another "tool_call" with broader parameters (e.g., remove the day filter, query the month). Only use "action": "answer" if the broader query also fails.`;
  }
}

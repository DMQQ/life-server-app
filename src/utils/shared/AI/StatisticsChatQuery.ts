import OpenAI from 'openai';
import { AIQuery, AIQueryConfig } from './AIResource.resource';
import { AiTool } from 'src/ai-chat/tools/base.tool';
import * as dayjs from 'dayjs';

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
    const today = (dayjs as any)().format('YYYY-MM-DD');
    const defaultStart = (dayjs as any)().startOf('month').format('YYYY-MM-DD');
    const defaultEnd = (dayjs as any)().endOf('month').format('YYYY-MM-DD');

    const dateInfo =
      dateContext.startDate && dateContext.endDate
        ? `Active date range: ${dateContext.startDate} → ${dateContext.endDate}. Use this range for all date-based tool calls unless user specifies otherwise.`
        : `No date range set. Default to current month: ${defaultStart} → ${defaultEnd}.`;

    const toolDocs = tools.map((t) => `  ${t.schema}`).join('\n');

    return `You are a personal life assistant with access to the user's expenses, events, goals and flashcards. Respond in the user's language. Currency is PLN.

CRITICAL: Never use markdown. No **, no *, no #, no backticks, no bullet points with dashes. Plain text only.

Today is ${today}. Timezone: Europe/Warsaw. Try harder to find relevant data for the user's question instead of saying you don't have enough information. Always call a tool if the user asked about data, even if you think it's unlikely to return results. If a tool returns empty results, try again with broader query params (e.g. wider date range, remove some filters).
${dateInfo}

QUERY PARAMS — all tools except wallet-stats accept this shape:
{
  where?:     { field: value | { eq?, ne?, gt?, gte?, lt?, lte?, like?, in?, between? } },
  select?:    string[],
  orderBy?:   { field: string, direction: "asc"|"desc" },
  groupBy?:   string | string[],
  aggregate?: [{ fn: "SUM"|"COUNT"|"AVG"|"MIN"|"MAX", field: string, alias?: string }],
  having?:    { field: value | operator },
  limit?:     number (max 100),
  offset?:    number
}

CATEGORY SEARCH RULES (important):
- Expense categories are stored as "mainCategory:subCategory" (e.g. "food:restaurant", "drinks:coffee").
- ALWAYS use { like: "term" } for category searches, never exact match.
- To find food expenses: { "category": { "like": "food" } }
- To find all drinks: { "category": { "like": "drinks" } }

TOOL CALL RULES:
- ALWAYS call a tool before answering questions about data. Never guess or say data doesn't exist without trying.
- If a tool returns empty results, try again with broader params (wider date range, remove filters).
- Use the active date range for all chart/stats tools.

TOOLS — call one per turn:
${toolDocs}

RESPONSE FORMAT — always valid JSON:

Tool call:
{ "action": "tool_call", "tool": "<name>", ...queryParams }

Examples:
{ "action": "tool_call", "tool": "legend", "where": { "startDate": "${defaultStart}", "endDate": "${defaultEnd}" } }
{ "action": "tool_call", "tool": "expenses", "where": { "category": { "like": "food" }, "date": { "between": ["${defaultStart}", "${defaultEnd}"] } }, "orderBy": { "field": "amount", "direction": "desc" }, "limit": 10 }
{ "action": "tool_call", "tool": "events", "where": { "date": { "gte": "${today}" }, "isCompleted": false }, "orderBy": { "field": "date", "direction": "asc" }, "limit": 10 }

Final answer:
{ "action": "answer", "messages": [
  { "type": "text", "content": "plain text, no markdown" },
  { "type": "chart", "subtype": "legend" },
  { "type": "expense", "id": "<id from expenses tool result>" },
  { "type": "subscription", "id": "<id from subscriptions tool result>" },
  { "type": "event", "id": "<id from events tool result>" },
  { "type": "timelineWidget" }
] }

RULES:
1. Always prefer chart or card over plain text when data is available.
2. If you called a chart tool, always include its chart item in messages.
3. If you fetched expenses/events/subscriptions, always show them as cards.
4. Only reference IDs from tool results. Never invent IDs.
5. chart subtype must exactly match the tool name (e.g. "legend", "dailySpendings").
6. If you called timelineWidget, include { "type": "timelineWidget" } — no id needed.`;
  }
}

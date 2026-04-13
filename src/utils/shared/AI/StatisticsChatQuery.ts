import OpenAI from 'openai';
import { AIQuery, AIQueryConfig } from './AIResource.resource';
import { AiTool } from 'src/ai-chat/tools/base.tool';

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
      temperature: 0.5,
      response_format: { type: 'json_object' },
    };
  }

  async buildMessages(input: StatisticsChatInput): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    return [{ role: 'system', content: this.buildSystemPrompt(input) }, ...input.conversation];
  }

  private buildSystemPrompt({ tools, dateContext }: StatisticsChatInput): string {
    const dateInfo =
      dateContext.startDate && dateContext.endDate
        ? `User's current date range: ${dateContext.startDate} → ${dateContext.endDate}.`
        : '';

    const toolDocs = tools.map((t) => `  ${t.schema}`).join('\n');

    return `You are a personal life assistant with access to the user's expenses, events, goals and flashcards. Respond in the user's language. Currency is PLN.

CRITICAL: Never use markdown. No **, no *, no #, no backticks, no bullet points with dashes. Plain text only.

${dateInfo}

QUERY PARAMS — all tools accept the same shape:
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

TOOLS — call one per turn:
${toolDocs}

RESPONSE FORMAT — always valid JSON:

Tool call:
{ "action": "tool_call", "tool": "<name>", ...queryParams }

Examples:
{ "action": "tool_call", "tool": "legend", "where": { "startDate": "2024-01-01", "endDate": "2024-01-31" } }
{ "action": "tool_call", "tool": "expenses", "where": { "date": { "gte": "2024-01-01" } }, "orderBy": { "field": "amount", "direction": "desc" }, "limit": 5 }
{ "action": "tool_call", "tool": "events", "where": { "date": { "gte": "2024-01-01" }, "isCompleted": false }, "orderBy": { "field": "date", "direction": "asc" }, "limit": 10 }

Final answer — messages array where each item is a segment:
{ "action": "answer", "messages": [
  { "type": "text", "content": "plain text, no markdown" },
  { "type": "chart", "subtype": "legend" },
  { "type": "expense", "id": "<id from expenses tool result>" },
  { "type": "subscription", "id": "<id from subscriptions tool result>" },
  { "type": "event", "id": "<id from events tool result>" },
  { "type": "timelineWidget" }
] }

SKILL PRIORITY RULES (strictly follow):
1. Always prefer returning a chart or card skill over plain text when data is available.
2. If you called a chart tool (legend, dayOfWeek, dailySpendings, dailyBreakdown) always include its chart item.
3. If you fetched specific expenses, events or subscriptions — always show them as cards.
4. Text segments should introduce or explain the skills, not replace them.
5. Only reference IDs that actually appeared in tool results. Never invent IDs.
6. chart subtype must exactly match the tool name used (e.g. "legend", "dailySpendings").
7. If you called timelineWidget tool, always include { "type": "timelineWidget" } in messages — no id needed, data is injected automatically.`;
  }
}

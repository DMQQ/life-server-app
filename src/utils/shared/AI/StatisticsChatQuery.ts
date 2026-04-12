import OpenAI from 'openai';
import { AIQuery, AIQueryConfig } from 'src/utils/shared/AI/AIResource.resource';

export interface StatChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AvailableSkills {
  chartSubtypes: string[];
  expenses: { id: string; description: string; amount: number }[];
  subscriptions: { id: string; description: string }[];
}

export interface StatisticsChatInput {
  statType: string;
  data: any;
  message: string;
  history: StatChatMessage[];
  availableSkills: AvailableSkills;
}

export interface AiSkillRef {
  type: 'chart' | 'expense' | 'subscription';
  subtype?: string;
  id?: string;
}

export interface StatisticsChatOutput {
  message: string;
  skills: AiSkillRef[];
}

export class StatisticsChatQuery extends AIQuery<StatisticsChatInput, StatisticsChatOutput> {
  getName() {
    return 'StatisticsChatQuery';
  }

  getConfig(): AIQueryConfig {
    return {
      model: 'gpt-4o-mini',
      max_completion_tokens: 2500,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    };
  }

  async buildMessages(input: StatisticsChatInput): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const { availableSkills } = input;

    const skillDocs = [
      availableSkills.chartSubtypes.length > 0 &&
        `CHARTS — use { "type": "chart", "subtype": "<name>" } where subtype is one of: ${availableSkills.chartSubtypes.join(', ')}`,
      availableSkills.expenses.length > 0 &&
        `EXPENSES — use { "type": "expense", "id": "<id>" } — valid entries:\n${availableSkills.expenses.map((e) => `  ${e.id}  "${e.description}"  ${e.amount} PLN`).join('\n')}`,
      availableSkills.subscriptions.length > 0 &&
        `SUBSCRIPTIONS — use { "type": "subscription", "id": "<id>" } — valid entries:\n${availableSkills.subscriptions.map((s) => `  ${s.id}  "${s.description}"`).join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const systemPrompt = `You are a personal finance assistant. The user is viewing their "${input.statType}" spending statistics. Respond in the user's language. Currency is Polish Złoty (PLN). Do NOT use markdown. Format with plain text, line breaks, and dashes only.

Current data:
${JSON.stringify(input.data, null, 2)}

---
SKILLS — you may embed rich UI elements inline in your response using [skill:N] placeholders.
Place [skill:N] exactly where in the message the element should appear. Skills are zero-indexed in order of appearance.

${skillDocs || 'No skills available for this query.'}

Rules:
- ALWAYS use skills when relevant data is available. A response without skills is a last resort.
- Embed a chart skill whenever you mention a trend, category, comparison, or any numeric insight that has a matching chart subtype.
- Embed an expense skill when you refer to a specific transaction.
- Embed a subscription skill when you mention a subscription.
- Place [skill:N] right after the sentence it illustrates, not at the end of the whole message.
- Only reference IDs listed above. Never invent IDs.
- Only reference chart subtypes that exist in the data above.

Respond ONLY with valid JSON:
{
  "message": "text with optional [skill:N] placeholders",
  "skills": [
    { "type": "chart", "subtype": "legend" },
    { "type": "expense", "id": "valid-uuid" }
  ]
}`;

    return [
      { role: 'system', content: systemPrompt },
      ...input.history.map(
        (m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam,
      ),
      { role: 'user', content: input.message },
    ];
  }
}

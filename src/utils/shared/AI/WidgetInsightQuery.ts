import OpenAI from 'openai';
import { AIQuery, AIQueryConfig } from './AIResource.resource';

export interface WidgetInsightInput {
  userMessage: string;
  widgetSubtype: string;
  widgetData: any;
}

const ANALYSIS_GUIDE: Record<string, string> = {
  legend: `Category breakdown chart. Analyze:
- Which category consumes the largest share and whether that's expected or alarming
- Any surprising or hidden categories (e.g. "none" meaning uncategorized — flag it)
- Top 2-3 categories by total and their combined % of spend`,

  dayOfWeek: `Day-of-week spending pattern. Analyze:
- Which day has the highest average spend and why it might be (e.g. Friday = outings)
- Which day is cheapest — is there a behavioral pattern?
- Whether spending is concentrated in a few days or spread evenly`,

  dailySpendings: `Daily spending timeline. Analyze:
- Any single-day spikes — what date, how large, is it an outlier?
- Overall trend: is spending accelerating, decelerating, or flat?
- Are there long quiet periods followed by burst spending?`,

  dailyBreakdown: `Daily category breakdown. Analyze:
- Days with the highest category diversity (many categories = impulse day?)
- Which category appears most frequently across days
- Any single category dominating a particular day`,

  zeroExpenseDays: `Zero-expense days tracker. Analyze:
- Total zero-expense days and what % of the period that represents
- Longest streak of zero-expense days and whether that's impressive or negligible
- Estimated money saved based on the avg daily spend`,

  spendingsLimits: `Budget limits vs actual spend. Analyze:
- Whether the total budget was exceeded and by how much
- Which categories are close to their limit (>80%) — name them specifically
- Which categories have budget headroom left and how much`,

  balancePrediction: `Balance projection. Analyze:
- Monthly net (income - expenses) and whether it's healthy
- How long until a round-number milestone (e.g. 100k, 200k PLN)
- Whether the projection trend is sustainable or concerning`,
};

export class WidgetInsightQuery extends AIQuery<WidgetInsightInput, string> {
  getName() {
    return 'WidgetInsightQuery';
  }

  getConfig(): AIQueryConfig {
    return {
      model: 'gpt-4o-mini',
      max_completion_tokens: 220,
      temperature: 0.3,
    };
  }

  async buildMessages(input: WidgetInsightInput): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const guide = ANALYSIS_GUIDE[input.widgetSubtype] ?? `Chart type: ${input.widgetSubtype}. Identify the most important number, trend, or anomaly in the data.`;

    return [
      {
        role: 'system',
        content: `You are a data analyst assistant. Respond in Polish. Currency is PLN.
Write 2-4 sentences of actual analysis — specific numbers, concrete observations, actionable takeaways.
No filler, no personality, no sarcasm. Just the insight that matters most for this chart type.
No markdown, plain text only.

Analysis focus for this chart:
${guide}`,
      },
      {
        role: 'user',
        content: `User asked: "${input.userMessage}"\n\nData:\n${JSON.stringify(input.widgetData, null, 2)}`,
      },
    ];
  }
}

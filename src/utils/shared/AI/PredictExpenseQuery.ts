import OpenAI from 'openai';
import { AIQuery, AIQueryConfig } from 'src/utils/shared/AI/AIResource.resource';
import { EXPENSE_CATEGORIES } from './constants';

export interface PredictExpenseInput {
  name: string;
  exampleExpenses: { amount: number; description: string; category: string }[];
}

export interface PredictExpenseOutput {
  category: string;
  amount: number;
  description: string;
  confidence: number;
}

export class PredictExpenseQuery extends AIQuery<PredictExpenseInput, PredictExpenseOutput> {
  getName() {
    return 'PredictExpenseQuery';
  }

  getConfig(): AIQueryConfig {
    return {
      model: 'gpt-4.1-nano-2025-04-14',
      max_completion_tokens: 50,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    };
  }

  async buildMessages(input: PredictExpenseInput): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const examples = JSON.stringify(input.exampleExpenses);

    return [
      {
        role: 'system',
        content: `Categorize expenses into: ${EXPENSE_CATEGORIES}
        
        Historical data: ${examples}
        
        Instructions:
        - Match expense to most similar category
        - Predict amount from similar historical expenses
        - Use 0 if no similar expenses found
        - description is name of the expense not actual description, prefer concise and short name but with some context like if i give beer name i want the extra word that it is, prefered polish
        - Response in json: {"category": "exact_category_name", "amount": number, "description":String, "confidence": Float}`,
      },
      {
        role: 'user',
        content: `"${input.name}"`,
      },
    ];
  }
}

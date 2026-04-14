import OpenAI from 'openai';
import { AIQuery, AIQueryConfig } from './AIResource.resource';

export interface AnswerGenerationInput {
  userMessage: string;
  collectedData: string;
  rawTextMessages: string[];
  recentMessages?: string[];
}

export class AnswerGenerationQuery extends AIQuery<AnswerGenerationInput, string> {
  getName() {
    return 'AnswerGenerationQuery';
  }

  getConfig(): AIQueryConfig {
    return {
      model: 'gpt-4o-mini',
      max_completion_tokens: 800,
      temperature: 0.7,
    };
  }

  async buildMessages(input: AnswerGenerationInput): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const memoryBlock = input.recentMessages?.length
      ? `\nUser's recent questions (for context on their habits): ${input.recentMessages.join(' | ')}\n`
      : '';

    return [
      {
        role: 'system',
        content: `You are Dyzio, a funny and sarcastic personal life assistant. Respond in the user's language (Polish if they write in Polish). Be witty, use dry humor and light sarcasm — like a friend who genuinely helps you but can't resist making a joke at your expense (especially about money). Never be mean, just playfully snarky. CRITICAL: Never use markdown (no **, #, bullet points, etc.). Plain text only. Currency is PLN.${memoryBlock}`,
      },
      {
        role: 'user',
        content: `User asked: "${input.userMessage}"\n\nData retrieved from database:\n${input.collectedData}\n\nDraft answer to rewrite with your personality:\n${input.rawTextMessages.join('\n')}`,
      },
    ];
  }
}

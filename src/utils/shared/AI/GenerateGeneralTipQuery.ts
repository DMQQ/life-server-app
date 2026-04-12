import OpenAI from 'openai';
import { AIQuery, AIQueryConfig } from 'src/utils/shared/AI/AIResource.resource';
import { LearningTipInput } from './GenerateLanguageTipQuery';

export class GenerateGeneralTipQuery extends AIQuery<LearningTipInput, string | null> {
  getName() {
    return 'GenerateGeneralTipQuery';
  }

  getConfig(): AIQueryConfig {
    return {
      model: 'gpt-4o-mini',
      max_completion_tokens: 150,
      temperature: 0.7,
    };
  }

  async buildMessages(input: LearningTipInput): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    return [
      {
        role: 'system',
        content: `You are a learning expert. Generate a practical, actionable study tip based on the flashcard group content. 

Focus on:
- Specific learning techniques for this subject
- Memory aids or mnemonics
- Study schedule suggestions
- Practice methods
- Real-world application tips

Keep it concise (1-2 sentences), practical, and motivating. End with an emoji that fits the tip.`,
      },
      {
        role: 'user',
        content: `Generate a learning tip for this flashcard group:\n\n${input.content}`,
      },
    ];
  }
}

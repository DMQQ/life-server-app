import OpenAI from 'openai';
import { AIQuery, AIQueryConfig } from 'src/utils/shared/AI/AIResource.resource';

export interface LearningTipInput {
  content: string;
  groupName: string;
}

export class GenerateLanguageTipQuery extends AIQuery<LearningTipInput, string | null> {
  getName() {
    return 'GenerateLanguageTipQuery';
  }

  getConfig(): AIQueryConfig {
    return {
      model: 'gpt-4o-mini',
      max_completion_tokens: 200,
      temperature: 0.8,
    };
  }

  async buildMessages(input: LearningTipInput): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    return [
      {
        role: 'system',
        content: `You are a language learning expert. For language flashcard groups, provide either:

1. **New vocabulary examples** (2-3 short, useful words/phrases with brief explanations)
2. **Practical language tips** with real examples
3. **Memory tricks** for the specific language

Format your response as either:
- "New words: [word] - [meaning], [word] - [meaning]. Try using them today! 📚"
- "Quick tip: [practical advice with example]. Practice makes perfect! 🗣️"
- "Memory trick: [mnemonic or association]. Language learning hack! 🧠"

Keep it concise (1-2 sentences max), practical, and motivating. Focus on actionable content.`,
      },
      {
        role: 'user',
        content: `Generate language learning content for this flashcard group:\n\n${input.content}`,
      },
    ];
  }
}

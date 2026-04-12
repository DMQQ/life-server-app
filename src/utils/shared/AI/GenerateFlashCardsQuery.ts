import OpenAI from 'openai';
import { AIQuery, AIQueryConfig } from 'src/utils/shared/AI/AIResource.resource';

export interface GenerateFlashcardsInput {
  content: string;
  existingFlashcards?: string[];
}

export interface Flashcard {
  question: string;
  answer: string;
  explanation: string;
  difficulty: string;
}

export class GenerateFlashcardsQuery extends AIQuery<GenerateFlashcardsInput, Flashcard[]> {
  getName() {
    return 'GenerateFlashcardsQuery';
  }

  getConfig(): AIQueryConfig {
    return {
      model: 'gpt-4.1-nano-2025-04-14',
      max_completion_tokens: 4000,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    };
  }

  async buildMessages(input: GenerateFlashcardsInput): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const existingTopics =
      input.existingFlashcards && input.existingFlashcards.length > 0
        ? `\n\nExisting flashcard topics to avoid duplicating:\n${input.existingFlashcards.map((card, i) => `${i + 1}. ${card}`).join('\n')}`
        : '';

    return [
      {
        role: 'system',
        content: `Create educationally optimized flashcards that promote deep learning and retention. Focus on understanding, application, and critical thinking rather than rote memorization.

          Educational Framework:
          - COMPREHENSION: Test understanding of concepts, not just recall
          - APPLICATION: Include real-world scenarios and practical examples  
          - ANALYSIS: Create questions that require breaking down complex ideas
          - SYNTHESIS: Connect concepts across different topics
          - EVALUATION: Encourage critical assessment and judgment

          Flashcard Design Principles:
          - Use active recall techniques with "why" and "how" questions
          - Create progressive difficulty levels within the set
          - Include scenario-based questions for practical application
          - Add comparative questions to highlight distinctions
          - Use the minimum information principle (one concept per card)
          - Employ desirable difficulties that enhance learning

          Question Types to Include:
          - Conceptual: "Explain the relationship between X and Y"
          - Procedural: "How would you approach/solve..."
          - Conditional: "When would you use X instead of Y?"
          - Causal: "What causes/leads to/results in..."
          - Comparative: "What's the key difference between..."
          - Applied: "In scenario X, how would you..."

          Quality Standards:
          - Questions must be unambiguous and precisely worded
          - Answers should be comprehensive yet concise
          - Explanations must provide learning context and connections
          - Include memory aids, mnemonics, or mental models when applicable
          - Add common misconceptions or pitfalls in explanations

          Generate 8-25 flashcards based on content complexity. Prioritize depth over quantity.
          DO NOT duplicate existing topics${existingTopics}

          Return JSON: {"flashcards": [{"question": "string", "answer": "string", "explanation": "string", "difficulty": "beginner|intermediate|advanced"}]}`,
      },
      {
        role: 'user',
        content: input.content,
      },
    ];
  }

  parse(response: OpenAI.Chat.Completions.ChatCompletion): Flashcard[] {
    //@ts-ignore
    const parsed = super.parse(response) as { flashcards: Flashcard[] };
    return parsed.flashcards;
  }
}

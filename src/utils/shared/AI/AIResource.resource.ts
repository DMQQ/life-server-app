import OpenAI from 'openai';

export interface AIQueryConfig {
  model: string;
  max_completion_tokens?: number;
  temperature?: number;
  response_format?: { type: 'text' | 'json_object' };
}

export abstract class AIQuery<Input, Output> {
  abstract getName(): string;
  abstract buildMessages(input: Input): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]>;

  getConfig(): AIQueryConfig {
    return {
      model: 'gpt-4o-mini',
      max_completion_tokens: 500,
      temperature: 0.7,
    };
  }

  parse(response: OpenAI.Chat.Completions.ChatCompletion): Output {
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error(`[${this.getName()}] OpenAI returned empty content`);
    }

    const isJson = this.getConfig().response_format?.type === 'json_object';

    if (isJson) {
      try {
        return JSON.parse(content) as Output;
      } catch (error) {
        throw new Error(`[${this.getName()}] Failed to parse JSON response: ${error}`);
      }
    }

    return content as unknown as Output;
  }
}

import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AIQuery } from 'src/utils/shared/AI/AIResource.resource';

@Injectable()
export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env['OPEN_AI_API_KEY'],
    });
  }

  async execute<Input, Output>(query: AIQuery<Input, Output>, input: Input): Promise<Output> {
    const config = query.getConfig();
    const messages = await query.buildMessages(input);

    const response = await this.client.chat.completions.create({
      model: config.model,
      temperature: config.temperature,
      max_completion_tokens: config.max_completion_tokens,
      response_format: config.response_format,
      messages: messages,
    });

    return query.parse(response);
  }
}

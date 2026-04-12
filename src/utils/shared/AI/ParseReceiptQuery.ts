import OpenAI from 'openai';
import * as sharp from 'sharp';
import { AIQuery, AIQueryConfig } from 'src/utils/shared/AI/AIResource.resource';
import { EXPENSE_CATEGORIES } from './constants';

export interface ParseReceiptInput {
  base64Image: string;
}

export interface ParseReceiptOutput {
  merchant: string;
  total_price: number;
  date: string;
  title: string;
  category: string;
  subexpenses: {
    name: string;
    quantity: number;
    amount: number;
    category: string;
  }[];
}

export class ParseReceiptQuery extends AIQuery<ParseReceiptInput, ParseReceiptOutput> {
  getName() {
    return 'ParseReceiptQuery';
  }

  getConfig(): AIQueryConfig {
    return {
      model: 'gpt-4.1-nano-2025-04-14',
      max_completion_tokens: 2000,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    };
  }

  async buildMessages(input: ParseReceiptInput): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const base64Data = input.base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const processedBuffer = await sharp(buffer)
      .resize(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 75 })
      .toBuffer();

    const optimizedBase64 = processedBuffer.toString('base64');

    return [
      {
        role: 'system',
        content: `You are a receipt parser. Extract data from receipt images and categorize expenses using these categories: ${EXPENSE_CATEGORIES}`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this receipt and extract:
            1. merchant: store/restaurant name. If unclear return empty string 
            2. total_price: final amount paid
            3. date: transaction date (YYYY-MM-DD format) - VERIFY DATE ACCURACY, double-check day/month/year
            4. title: IN POLISH - If only ONE item purchased, use that item name as title. If multiple items, use generalized category description BUT IF possible to read add Shop name to description otherwise dont (e.g. "Zakupy spożywcze" for groceries, "Odzież" for clothes, "Piwo" for beer items, "Obiad" for restaurant meals, "Leki" for medicines, "Kosmetyki" for cosmetics) but add shop name to end if generic name OR first expense name 
            5. category: main expense category from the list
            6. subexpenses: individual items with name, quantity, amount, and category, BE PRECISE IN AMOUNT
            
            Return as JSON:
            {
              "merchant": "string",
              "total_price": number,
              "date": "YYYY-MM-DD",
              "title": "generalized purchase type in Polish",
              "category": "category_from_list",
              "subexpenses": [
                {
                  "name": "item name",
                  "quantity": number,
                  "amount": number,
                  "category": "category_from_list"
                }
              ]
            }`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${optimizedBase64}`,
              detail: 'high',
            },
          },
        ],
      },
    ];
  }
}

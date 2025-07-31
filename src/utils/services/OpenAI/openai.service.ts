import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import * as sharp from 'sharp';

@Injectable()
export class OpenAIService {
  private client: OpenAI;

  categories =
    'housing, transportation, food, drinks, shopping, addictions, work, clothes, health, entertainment, utilities, debt, education, savings, travel, edit, income, animals, refunded, gifts, gifts:birthday, gifts:holiday, gifts:charitable, sports, sports:equipment, sports:memberships, sports:events, tech, tech:software, tech:accessories, tech:repairs, goingout, goingout:dining, goingout:nightlife, goingout:events, trips, trips:lodging, trips:activities, trips:transportation, subscriptions, investments, maintenance, insurance, taxes, children, donations, beauty, pets, weed, alcohol, vape, tattoos, dating, gambling, fastFood, videoGames, streaming, concerts, haircuts, health:therapy, health:gym, health:skincare, health:dentist, emergencies, carRepair, transportation:parking, housing:rent';

  private config = {
    model: 'gpt-4.1-nano-2025-04-14',
    max_tokens: 500,
    temperature: 0.1,
  } as any;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env['OPEN_AI_API_KEY'],
    });
  }

  async extractReceiptContent(base64Image: string) {
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const processedBuffer = await sharp(buffer)
      .resize(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 75 })
      .toBuffer();

    const optimizedBase64 = processedBuffer.toString('base64');

    return this.client.chat.completions.create({
      model: this.config.model,
      max_completion_tokens: this.config.max_tokens * 4,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a receipt parser. Extract data from receipt images and categorize expenses using these categories: ${this.categories}`,
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
      ],
    });
  }

  async predictExpense(name: string, exampleExpenses: { amount: number; description: string; category: string }[]) {
    const examples = JSON.stringify(exampleExpenses);

    return this.client.chat.completions.create({
      model: this.config.model,
      max_completion_tokens: 50,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Categorize expenses into: ${this.categories}
          
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
          content: `"${name}"`,
        },
      ],
    });
  }

  async generateFlashCards(content: string, existingFlashcards: string[] = []) {
    const existingTopics =
      existingFlashcards.length > 0
        ? `\n\nExisting flashcard topics to avoid duplicating:\n${existingFlashcards.map((card, i) => `${i + 1}. ${card}`).join('\n')}`
        : '';

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      max_completion_tokens: this.config.max_tokens * 8,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
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
          content: content,
        },
      ],
    });

    const parsedContent = JSON.parse(response.choices[0].message.content);
    return parsedContent.flashcards;
  }

  async generateLanguageLearningTip(content: string, groupName: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_completion_tokens: 200,
      temperature: 0.8,
      messages: [
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
          content: `Generate language learning content for this flashcard group:\n\n${content}`,
        },
      ],
    });

    return response.choices[0]?.message?.content?.trim() || null;
  }

  async generateGeneralLearningTip(content: string, groupName: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_completion_tokens: 150,
      temperature: 0.7,
      messages: [
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
          content: `Generate a learning tip for this flashcard group:\n\n${content}`,
        },
      ],
    });

    return response.choices[0]?.message?.content?.trim() || null;
  }
}

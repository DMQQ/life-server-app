import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExpenseEntity, WalletEntity } from './wallet.entity';
import { Like, Repository } from 'typeorm';
import { OpenAIService } from 'src/utils/services/OpenAI/openai.service';

@Injectable()
export class ExpensePredictionService {
  constructor(
    @InjectRepository(WalletEntity)
    private walletEntity: Repository<WalletEntity>,

    @InjectRepository(ExpenseEntity)
    private expenseEntity: Repository<ExpenseEntity>,

    private openAIService: OpenAIService,
  ) {}
  async predictExpense(userId: string, input: string, amount?: number) {
    try {
      const wallet = await this.walletEntity
        .createQueryBuilder('wallet')
        .where('wallet.userId = :userId', { userId })
        .getOne();

      if (!wallet) {
        throw new Error('Wallet not found for user');
      }

      const recentExpenses = await this.expenseEntity
        .createQueryBuilder('expense')
        .where('expense.walletId = :walletId', { walletId: wallet.id })
        .andWhere('expense.schedule = :schedule', { schedule: false })
        .orderBy('expense.date', 'DESC')
        .limit(400)
        .getMany();

      const predictions = this.calculatePredictions(input, recentExpenses, amount);

      console.log(predictions);

      if (predictions.length > 0) {
        const bestMatch = predictions[0];

        if (amount) {
          bestMatch.amount = amount;
        }

        return bestMatch;
      } else if (predictions.length === 0) {
        const similarExpenses = await this.expenseEntity.find({
          select: ['amount', 'description', 'category'],
          where: {
            description: Like(`%${input}%`),
          },
        });

        const aiPrediction = await this.openAIService.predictExpense(input, similarExpenses);

        console.log('AI Usage', aiPrediction.usage);

        const match = JSON.parse(aiPrediction.choices[0].message.content);

        return {
          description: input,
          confidence: 1,
          shop: null,
          type: 'expense',
          ...match,
        };
      }

      return null;
    } catch (error) {
      console.error('Error in predictExpense:', error);
      throw error;
    }
  }

  private calculatePredictions(input: string, expenses: ExpenseEntity[], requestedAmount?: number) {
    const predictions = [];
    const normalizedInput = input?.toLowerCase().trim() || '';

    if (normalizedInput.length < 3) {
      return [];
    }

    for (const expense of expenses) {
      if (!expense || !expense.description) continue;

      const normalizedExpense = expense.description.toLowerCase().trim();

      if (normalizedExpense === normalizedInput) {
        predictions.push({
          ...this.mapExpenseToDto(expense),
          confidence: 1.0,
        });
        continue;
      }

      if (normalizedExpense.includes(normalizedInput) || normalizedInput.includes(normalizedExpense)) {
        const confidence = this.calculateContainmentScore(normalizedInput, normalizedExpense);

        if (confidence > 0.6) {
          predictions.push({
            ...this.mapExpenseToDto(expense),
            confidence,
          });
        }
        continue;
      }
      const similarity = this.calculateSimilarity(normalizedInput, normalizedExpense);

      if (similarity > 0.5) {
        predictions.push({
          ...this.mapExpenseToDto(expense),
          confidence: similarity,
        });
      }
    }

    predictions.sort((a, b) => b.confidence - a.confidence);

    return predictions.slice(0, 5);
  }

  private mapExpenseToDto(expense: ExpenseEntity) {
    if (!expense) {
      return {
        description: '',
        amount: 0,
        category: '',
        type: '',
        shop: null,
        locationId: null,
      };
    }

    return {
      description: expense.description || '',
      amount: expense.amount || 0,
      category: expense.category || '',
      type: expense.type || '',
      shop: expense.shop || null,
    };
  }

  private calculateContainmentScore(str1: string, str2: string): number {
    const shorter = str1.length <= str2.length ? str1 : str2;
    const longer = str1.length > str2.length ? str1 : str2;

    if (longer.includes(shorter)) {
      return shorter.length / longer.length;
    }

    return 0;
  }

  private calculateSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    const maxLength = Math.max(s1.length, s2.length);
    const lenS1 = s1.length;
    const lenS2 = s2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= lenS1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= lenS2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= lenS1; i++) {
      for (let j = 1; j <= lenS2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      }
    }

    const distance = matrix[lenS1][lenS2];
    return 1 - distance / maxLength;
  }
}

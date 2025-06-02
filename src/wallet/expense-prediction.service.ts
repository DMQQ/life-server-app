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
        .limit(300)
        .getMany();

      const predictions = this.calculatePredictions(input, recentExpenses, amount);

      if (predictions.length > 0) {
        const bestMatch = predictions[0];

        if (amount) {
          bestMatch.amount = amount;
        }

        return bestMatch;
      } else if (predictions.length === 0) {
        const similarExpenses = await this.expenseEntity.find({
          select: ['amount', 'description', 'category'],
          where: input.split(' ').map((word) => ({
            description: Like(`%${word}%`),
          })),
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

    const inputWords = this.tokenizeAndFilter(normalizedInput);

    if (inputWords.length === 0) {
      return [];
    }

    for (const expense of expenses) {
      if (!expense || !expense.description) continue;

      const normalizedExpense = expense.description.toLowerCase().trim();
      const expenseWords = this.tokenizeAndFilter(normalizedExpense);

      if (expenseWords.length === 0) continue;

      if (normalizedExpense === normalizedInput) {
        predictions.push({
          ...this.mapExpenseToDto(expense),
          confidence: 1.0,
        });
        continue;
      }

      const confidence = this.calculateWordBasedSimilarity(inputWords, expenseWords);

      if (confidence > 0.75) {
        predictions.push({
          ...this.mapExpenseToDto(expense),
          confidence,
        });
      }
    }

    predictions.sort((a, b) => b.confidence - a.confidence);
    return predictions.slice(0, 3);
  }

  private tokenizeAndFilter(text: string): string[] {
    const stopWords = new Set([
      'the',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'up',
      'about',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'among',
      'a',
      'an',
      'is',
      'was',
      'are',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
    ]);

    return text
      .split(/[\s\-_.,;:!?()[\]{}'"]+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 1 && !stopWords.has(word))
      .filter((word) => !/^\d+$/.test(word));
  }

  private calculateWordBasedSimilarity(inputWords: string[], expenseWords: string[]): number {
    if (inputWords.length === 0 || expenseWords.length === 0) {
      return 0;
    }

    let totalScore = 0;
    let maxPossibleScore = 0;
    const matchedExpenseWords = new Set<number>();

    for (let i = 0; i < inputWords.length; i++) {
      const inputWord = inputWords[i];
      const wordWeight = this.getWordWeight(inputWord, i, inputWords.length);
      maxPossibleScore += wordWeight;

      let bestMatchScore = 0;
      let bestMatchIndex = -1;

      for (let j = 0; j < expenseWords.length; j++) {
        if (matchedExpenseWords.has(j)) continue;

        const expenseWord = expenseWords[j];
        const similarity = this.calculateWordSimilarity(inputWord, expenseWord);

        if (similarity > bestMatchScore && similarity > 0.8) {
          bestMatchScore = similarity;
          bestMatchIndex = j;
        }
      }

      if (bestMatchIndex !== -1) {
        matchedExpenseWords.add(bestMatchIndex);
        totalScore += bestMatchScore * wordWeight;
      }
    }

    const baseScore = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;

    const coverageScore = this.calculateCoverageScore(inputWords, expenseWords, matchedExpenseWords);
    const lengthPenalty = this.calculateLengthPenalty(inputWords.length, expenseWords.length);
    const orderBonus = this.calculateOrderBonus(inputWords, expenseWords, matchedExpenseWords);

    return Math.max(0, Math.min(1, baseScore * coverageScore * lengthPenalty + orderBonus));
  }

  private getWordWeight(word: string, position: number, totalWords: number): number {
    let weight = 1.0;

    if (word.length >= 4) weight += 0.3;
    if (word.length >= 6) weight += 0.2;

    const positionWeight = 1 - position / (totalWords * 2);
    weight += positionWeight * 0.2;

    return weight;
  }

  private calculateWordSimilarity(word1: string, word2: string): number {
    if (word1 === word2) return 1.0;
    if (word1.length < 2 || word2.length < 2) return 0.0;

    if (word1.includes(word2) || word2.includes(word1)) {
      const shorter = word1.length <= word2.length ? word1 : word2;
      const longer = word1.length > word2.length ? word1 : word2;
      return shorter.length / longer.length;
    }

    const maxLength = Math.max(word1.length, word2.length);
    const distance = this.levenshteinDistance(word1, word2);

    return Math.max(0, 1 - distance / maxLength);
  }

  private calculateCoverageScore(inputWords: string[], expenseWords: string[], matchedIndices: Set<number>): number {
    const inputCoverage = matchedIndices.size / inputWords.length;
    const expenseCoverage = matchedIndices.size / expenseWords.length;

    if (inputCoverage < 0.6) {
      return inputCoverage / 0.6;
    }

    return Math.min(1.2, (inputCoverage + expenseCoverage) / 2);
  }

  private calculateLengthPenalty(inputLength: number, expenseLength: number): number {
    const ratio = Math.min(inputLength, expenseLength) / Math.max(inputLength, expenseLength);

    if (ratio < 0.3) {
      return 0.7;
    } else if (ratio < 0.5) {
      return 0.85;
    }

    return 1.0;
  }

  private calculateOrderBonus(inputWords: string[], expenseWords: string[], matchedIndices: Set<number>): number {
    if (matchedIndices.size < 2) return 0;

    const matchedWords = Array.from(matchedIndices).sort((a, b) => a - b);
    let orderScore = 0;

    for (let i = 1; i < matchedWords.length; i++) {
      if (matchedWords[i] === matchedWords[i - 1] + 1) {
        orderScore += 0.02;
      }
    }

    return Math.min(0.1, orderScore);
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const lenS1 = s1.length;
    const lenS2 = s2.length;

    if (lenS1 === 0) return lenS2;
    if (lenS2 === 0) return lenS1;

    const matrix: number[][] = Array(lenS1 + 1)
      .fill(null)
      .map(() => Array(lenS2 + 1).fill(0));

    for (let i = 0; i <= lenS1; i++) matrix[i][0] = i;
    for (let j = 0; j <= lenS2; j++) matrix[0][j] = j;

    for (let i = 1; i <= lenS1; i++) {
      for (let j = 1; j <= lenS2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      }
    }

    return matrix[lenS1][lenS2];
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
}

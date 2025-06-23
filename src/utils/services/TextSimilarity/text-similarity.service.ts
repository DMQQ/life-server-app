import { Injectable } from '@nestjs/common';

export interface SimilarityResult<T> {
  item: T;
  score: number;
}

@Injectable()
export class TextSimilarityService {
  findMostSimilar<T>(
    query: string,
    items: T[],
    getTextFn: (item: T) => string,
    threshold: number = 0,
  ): SimilarityResult<T>[] {
    const queryWords = this.preprocessText(query);

    return items
      .map((item) => ({
        item,
        score: this.calculateSimilarity(queryWords, getTextFn(item)),
      }))
      .filter((result) => result.score > threshold)
      .sort((a, b) => b.score - a.score);
  }

  calculateSimilarity(queryWords: string[], targetText: string): number {
    const targetWords = targetText.split(/\s+/);
    let score = 0;

    for (const queryWord of queryWords) {
      for (const targetWord of targetWords) {
        if (targetWord.includes(queryWord) || queryWord.includes(targetWord)) {
          score += queryWord.length === targetWord.length ? 2 : 1;
        }

        if (this.levenshteinDistance(queryWord, targetWord) <= 1 && queryWord.length > 3) {
          score += 1;
        }
      }
    }

    const commonWordsCount = queryWords.filter((word) =>
      targetWords.some((targetWord) => targetWord.includes(word) || word.includes(targetWord)),
    ).length;

    return score + (commonWordsCount / queryWords.length) * 3;
  }

  private preprocessText(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1)
      .fill(null)
      .map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
      }
    }

    return matrix[b.length][a.length];
  }
}

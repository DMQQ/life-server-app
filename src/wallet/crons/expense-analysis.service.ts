import { Injectable, Logger } from '@nestjs/common';
import { WalletService } from '../wallet.service';
import { ExpenseService } from '../expense.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { ExpenseType } from '../wallet.entity';
import * as dayjs from 'dayjs';
import { Cron, Interval } from '@nestjs/schedule';
import { ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class ExpenseAnalysisService {
  private readonly logger = new Logger(ExpenseAnalysisService.name);

  constructor(
    private walletService: WalletService,
    private expenseService: ExpenseService,
    private notificationService: NotificationsService,
  ) {}

  @Cron('0 7 * * 2', {
    // Tuesday at 2 PM
    timeZone: 'Europe/Warsaw',
  })
  async expenseDescriptionAnalysis() {
    this.logger.log('Running expense description analysis');
    const users = await this.notificationService.findAll();

    for (const user of users) {
      try {
        if (!user.token || user.isEnable === false) continue;

        // Use the dedicated service for analysis
        const analysisResult = await this.analyzeExpenseDescriptions(user.userId);

        if (!analysisResult) {
          this.logger.debug(`No analysis results for user ${user.userId}`);
          continue;
        }

        const notification = [
          {
            to: user.token,
            sound: 'default',
            title: analysisResult.title,
            body: analysisResult.body,
          },
        ] as ExpoPushMessage[];
        // Send the notification
        await this.notificationService.sendChunkNotifications(notification);
        this.notificationService.saveNotification(user.userId, notification[0]);
      } catch (error) {
        this.logger.error(`Error processing description analysis for user ${user.userId}: ${error.message}`);
      }
    }
  }

  /**
   * Analyzes expenses by grouping similar descriptions to identify spending patterns
   */
  async analyzeExpenseDescriptions(userId: string) {
    try {
      const walletId = await this.walletService.getWalletId(userId);
      if (!walletId) {
        this.logger.warn(`No wallet found for user ${userId}`);
        return null;
      }

      // Get expenses from last 3 months
      const threeMonthsAgo = dayjs().subtract(3, 'months').format('YYYY-MM-DD');
      const expenses = await this.expenseService.getExpensesForPeriod(walletId, [
        dayjs(threeMonthsAgo).startOf('day').format('YYYY-MM-DD HH:MM:ss'),
        dayjs().endOf('day').format('YYYY-MM-DD HH:MM:ss'),
      ]);

      if (!expenses || expenses.length < 15) {
        this.logger.debug(`Not enough expenses for user ${userId} to analyze`);
        return null;
      }

      // Filter to only include expenses (not income)
      const expenseItems = expenses.filter((e) => e.type === ExpenseType.expense);
      if (expenseItems.length < 10) {
        this.logger.debug(`Not enough expense items for user ${userId} to analyze`);
        return null;
      }

      // Calculate total spending in the 3-month period
      const totalSpending = expenseItems.reduce((sum, e) => sum + e.amount, 0);
      const totalExpenseCount = expenseItems.length;

      // Get all categories and create category-based keyword mapping for better grouping
      const categoryKeywordMap = this.buildDynamicCategoryKeywordMap(expenseItems);

      // Initial grouping by normalized description
      const descriptionGroups = this.createInitialDescriptionGroups(expenseItems);

      // Merge similar groups using dynamic category data
      const mergedGroups = this.mergeDescriptionGroups(descriptionGroups, categoryKeywordMap);

      // Convert to array and prepare for sorting
      const groupsArray = (Object.values(mergedGroups) as any).filter((group) => group.count >= 2); // Only include groups with at least 2 expenses

      if (groupsArray.length === 0) {
        this.logger.debug(`No meaningful expense groups for user ${userId}`);
        return null;
      }

      // Calculate metrics and create sorted arrays
      this.calculateMetrics(groupsArray, totalSpending, totalExpenseCount);
      const { topByAmount, topByFrequency, topByImpact } = this.getTopGroups(groupsArray);

      // Generate notification message
      const messageBody = this.createNotificationMessage(topByAmount, topByFrequency, topByImpact, totalSpending);

      return {
        title: '💰 Expense Analysis',
        body: messageBody.length > 178 ? messageBody.substring(0, 175) + '...' : messageBody,
        groups: groupsArray,
        topByAmount,
        topByFrequency,
        topByImpact,
      };
    } catch (error) {
      this.logger.error(`Error analyzing expense descriptions for user ${userId}: ${error.message}`);
      return null;
    }
  }

  private buildDynamicCategoryKeywordMap(expenseItems) {
    // Extract unique categories from expenses
    const categories = new Set<any>();

    // Map to store category -> common words relationships
    const categoryKeywords = {};

    // First, collect all categories and initialize the map
    for (const expense of expenseItems) {
      if (expense.category) {
        categories.add(expense.category);
        if (!categoryKeywords[expense.category]) {
          categoryKeywords[expense.category] = new Set();
        }
      }
    }

    // For each category, find common words in descriptions
    for (const category of categories) {
      // Get all expenses with this category
      const categoryExpenses = expenseItems.filter((e) => e.category === category);

      // Extract words from descriptions
      for (const expense of categoryExpenses) {
        if (expense.description) {
          const words = expense.description
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter((word) => word.length > 3); // Only consider words with length > 3

          // Add meaningful words to the category's keyword set
          for (const word of words) {
            categoryKeywords[category].add(word);
          }
        }
      }
    }

    // Convert Sets to Arrays for easier use
    const result = {};
    for (const category of categories) {
      result[category] = Array.from(categoryKeywords[category]);
    }

    // Include some hardcoded keywords for common categories to improve matching
    const hardcodedKeywords = {
      'Education/University': ['uwm', 'rata', 'czesne', 'studia', 'semestr', 'rekrutacja'],
      'PlayStation/Gaming': ['playstation', 'ps plus', 'ps', 'ea pass', 'subscription', 'mortal kombat'],
      'Work Meals': ['do pracy', 'praca', 'lunch', 'bułki do pracy', 'jedzenie'],
      Transportation: ['bolt', 'bilet', 'bilety', 'uber', 'pkp', 'autobus', 'miejski'],
      Groceries: ['lidl', 'biedronka', 'lewiatan', 'żabka', 'zabka', 'carrefour', 'carefour', 'zakupy'],
      'Energy Drinks': ['tiger', 'monster', 'energetyk'],
      'iCloud/Apple Services': ['icloud', 'cloud'],
    };

    // Merge hardcoded keywords with discovered keywords
    for (const [category, keywords] of Object.entries(hardcodedKeywords)) {
      // If the category exists in our dynamic categories, add the keywords
      const matchedCategory = Array.from(categories).find(
        (c) =>
          c.toString().toLowerCase().includes(category.toLowerCase()) ||
          category.toLowerCase().includes(c.toString().toLowerCase()),
      ) as any;

      if (matchedCategory) {
        result[matchedCategory] = [...(result[matchedCategory] || []), ...keywords];
      } else {
        // Otherwise add it as a new category
        result[category] = keywords;
      }
    }

    return result;
  }

  private createInitialDescriptionGroups(expenseItems) {
    const descriptionGroups = {};

    for (const expense of expenseItems) {
      if (!expense.description) continue;

      // Initial normalization
      const normalized = expense.description
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[^\w\s]/g, ''); // Remove non-alphanumeric chars except spaces

      if (!normalized || normalized.length < 2) continue;

      if (!descriptionGroups[normalized]) {
        descriptionGroups[normalized] = {
          descriptions: [expense.description],
          expenses: [expense],
          total: expense.amount,
          count: 1,
          categories: expense.category ? [expense.category] : [],
        };
      } else {
        descriptionGroups[normalized].descriptions.push(expense.description);
        descriptionGroups[normalized].expenses.push(expense);
        descriptionGroups[normalized].total += expense.amount;
        descriptionGroups[normalized].count++;
        if (expense.category && !descriptionGroups[normalized].categories.includes(expense.category)) {
          descriptionGroups[normalized].categories.push(expense.category);
        }
      }
    }

    return descriptionGroups;
  }

  private mergeDescriptionGroups(descriptionGroups, categoryKeywordMap) {
    const mergedGroups = {};
    const processedKeys = new Set();

    const descKeys = Object.keys(descriptionGroups);

    for (let i = 0; i < descKeys.length; i++) {
      const key1 = descKeys[i];
      if (processedKeys.has(key1)) continue;

      // Create a new merged group
      const mergedKey = `group_${i}`;
      mergedGroups[mergedKey] = {
        primaryDescription: descriptionGroups[key1].descriptions[0],
        allDescriptions: [...descriptionGroups[key1].descriptions],
        expenses: [...descriptionGroups[key1].expenses],
        total: descriptionGroups[key1].total,
        count: descriptionGroups[key1].count,
        categories: [...(descriptionGroups[key1].categories || [])],
      };

      processedKeys.add(key1);

      // Find similar descriptions to merge
      for (let j = i + 1; j < descKeys.length; j++) {
        const key2 = descKeys[j];
        if (processedKeys.has(key2)) continue;

        // Use semantic matching with dynamic category keywords
        if (this.shouldMergeGroups(key1, key2, descriptionGroups[key1], descriptionGroups[key2], categoryKeywordMap)) {
          mergedGroups[mergedKey].allDescriptions.push(...descriptionGroups[key2].descriptions);
          mergedGroups[mergedKey].expenses.push(...descriptionGroups[key2].expenses);
          mergedGroups[mergedKey].total += descriptionGroups[key2].total;
          mergedGroups[mergedKey].count += descriptionGroups[key2].count;

          // Merge categories
          if (descriptionGroups[key2].categories) {
            for (const category of descriptionGroups[key2].categories) {
              if (!mergedGroups[mergedKey].categories.includes(category)) {
                mergedGroups[mergedKey].categories.push(category);
              }
            }
          }

          processedKeys.add(key2);
        }
      }

      // Find most frequent description for the group
      const descriptionFreq = {};
      for (const desc of mergedGroups[mergedKey].allDescriptions) {
        descriptionFreq[desc] = (descriptionFreq[desc] || 0) + 1;
      }

      let mostFrequentDesc = '';
      let maxFreq = 0;
      for (const [desc, freq] of Object.entries(descriptionFreq) as any) {
        if (freq > maxFreq) {
          mostFrequentDesc = desc;
          maxFreq = freq;
        }
      }

      mergedGroups[mergedKey].primaryDescription = mostFrequentDesc;

      // Determine representative name for the group based on content and categories
      mergedGroups[mergedKey].groupName = this.determineGroupName(mergedGroups[mergedKey], categoryKeywordMap);
    }

    return mergedGroups;
  }

  private shouldMergeGroups(descA, descB, groupA, groupB, categoryKeywordMap) {
    // First check using Levenshtein similarity
    const similarity = this.calculateSimilarityRatio(descA, descB);
    if (similarity >= 0.7) return true;

    // Check if they share a category
    if (groupA.categories && groupB.categories && groupA.categories.some((cat) => groupB.categories.includes(cat))) {
      return true;
    }

    // Convert to lowercase for keyword matching
    const lowerA = descA.toLowerCase();
    const lowerB = descB.toLowerCase();

    // Check using dynamic category keywords
    for (const [category, keywords] of Object.entries(categoryKeywordMap)) {
      const categoryKeywords = keywords as string[];
      if (categoryKeywords.length > 0) {
        const matchesA = categoryKeywords.some((keyword) => lowerA.includes(keyword));
        const matchesB = categoryKeywords.some((keyword) => lowerB.includes(keyword));

        if (matchesA && matchesB) {
          return true;
        }
      }
    }

    return false;
  }

  private calculateLevenshteinDistance(a, b) {
    const matrix = Array(a.length + 1)
      .fill(undefined)
      .map(() => Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost, // substitution
        );
      }
    }

    return matrix[a.length][b.length];
  }

  private calculateSimilarityRatio(a, b) {
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 1.0;
    return 1.0 - this.calculateLevenshteinDistance(a, b) / maxLength;
  }

  private determineGroupName(group, categoryKeywordMap) {
    // If we have consistent categories, use that
    if (group.categories && group.categories.length === 1) {
      return group.categories[0];
    }

    // If we have multiple categories, check which one best matches the descriptions
    if (group.categories && group.categories.length > 1) {
      const allDescsLower = group.allDescriptions.map((d) => d.toLowerCase());

      // Score each category by how many of its keywords match in descriptions
      let bestCategory = null;
      let bestScore = 0;

      for (const category of group.categories) {
        const keywords = categoryKeywordMap[category] || [];
        let score = 0;

        for (const keyword of keywords) {
          for (const desc of allDescsLower) {
            if (desc.includes(keyword)) {
              score++;
            }
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestCategory = category;
        }
      }

      if (bestCategory) {
        return bestCategory;
      }
    }

    // Fallback to checking description content
    const allDescsLower = group.allDescriptions.map((d) => d.toLowerCase());

    // Check against known patterns
    for (const [category, keywords] of Object.entries(categoryKeywordMap)) {
      const categoryKeywords = keywords as string[];
      if (categoryKeywords.some((keyword) => allDescsLower.some((desc) => desc.includes(keyword)))) {
        return category;
      }
    }

    // If no matching category found, use the primary description
    return group.primaryDescription;
  }

  private calculateMetrics(groupsArray, totalSpending, totalExpenseCount) {
    for (const group of groupsArray) {
      // Calculate averages and percentages
      group.avgAmount = group.total / group.count;
      group.percentOfTotal = (group.total / totalSpending) * 100;
      group.frequencyPercentage = (group.count / totalExpenseCount) * 100;

      // Calculate impact score (weighted combination of amount and frequency)
      group.impactScore = group.percentOfTotal * 0.7 + group.frequencyPercentage * 0.3;
    }
  }

  private getTopGroups(groupsArray) {
    // Create multiple sorted arrays for different metrics
    const byAmountGroups = [...groupsArray].sort((a, b) => b.percentOfTotal - a.percentOfTotal);
    const byFrequencyGroups = [...groupsArray].sort((a, b) => b.count - a.count);
    const byImpactGroups = [...groupsArray].sort((a, b) => b.impactScore - a.impactScore);

    // Take top 3 from each
    const topByAmount = byAmountGroups.slice(0, 3);
    const topByFrequency = byFrequencyGroups.slice(0, 3);
    const topByImpact = byImpactGroups.slice(0, 3);

    return { topByAmount, topByFrequency, topByImpact };
  }

  private createNotificationMessage(topByAmount, topByFrequency, topByImpact, totalSpending) {
    let messageBody = '';

    // Format amount with appropriate precision (no decimals for larger amounts)
    const formatAmount = (amount) => {
      return amount >= 100 ? Math.round(amount) : amount.toFixed(1);
    };

    // Helper to create consistent category format strings
    const formatCategory = (group, includePercent = true) => {
      const amountValue = formatAmount(group.total);
      let result = `${group.groupName}: ${group.count}x`;

      if (includePercent) {
        result += ` (${group.percentOfTotal.toFixed(1)}%)`;
      }

      result += `, ${amountValue}zł`;
      return result;
    };

    // Debug log for troubleshooting
    console.log(
      'Top by amount:',
      topByAmount.map((g) => ({
        name: g.groupName,
        percent: g.percentOfTotal.toFixed(1),
        amount: g.total,
        count: g.count,
      })),
    );

    console.log(
      'Top by frequency:',
      topByFrequency.map((g) => ({
        name: g.groupName,
        percent: g.percentOfTotal.toFixed(1),
        amount: g.total,
        count: g.count,
      })),
    );

    console.log(
      'Top by impact:',
      topByImpact.map((g) => ({
        name: g.groupName,
        percent: g.percentOfTotal.toFixed(1),
        amount: g.total,
        count: g.count,
      })),
    );

    // Find the top 3 significant categories based primarily on amount
    // but considering frequency for tie-breakers
    const significantCategories = [];
    const addedCategories = new Set();

    // First add top categories by amount
    for (const category of topByAmount) {
      if (!addedCategories.has(category.groupName)) {
        significantCategories.push({
          ...category,
          source: 'amount',
        });
        addedCategories.add(category.groupName);

        if (significantCategories.length >= 3) {
          break;
        }
      }
    }

    // Then add top categories by frequency if they're not already included
    // and they represent at least 5% of spending
    for (const category of topByFrequency) {
      if (
        !addedCategories.has(category.groupName) &&
        category.percentOfTotal >= 5.0 &&
        significantCategories.length < 3
      ) {
        significantCategories.push({
          ...category,
          source: 'frequency',
        });
        addedCategories.add(category.groupName);
      }
    }

    // If we still don't have 3 categories, consider ones with high frequency
    // even if percentage is lower, but still at least 3%
    if (significantCategories.length < 3) {
      for (const category of topByFrequency) {
        if (
          !addedCategories.has(category.groupName) &&
          category.percentOfTotal >= 3.0 &&
          category.count >= 10 &&
          significantCategories.length < 3
        ) {
          significantCategories.push({
            ...category,
            source: 'frequency',
          });
          addedCategories.add(category.groupName);
        }
      }
    }

    // Create the message based on what we found
    if (significantCategories.length > 0) {
      // Sort by significance (percentage)
      significantCategories.sort((a, b) => b.percentOfTotal - a.percentOfTotal);

      // If the first item is much more significant, highlight it
      if (
        significantCategories[0].percentOfTotal > 15 ||
        (significantCategories.length > 1 &&
          significantCategories[0].percentOfTotal > significantCategories[1].percentOfTotal * 1.5)
      ) {
        messageBody = `Top expense: ${formatCategory(significantCategories[0])}`;
      } else {
        messageBody = 'Top expenses: ';
      }

      // Add the first category if not already added
      if (!messageBody.includes(significantCategories[0].groupName)) {
        messageBody += formatCategory(significantCategories[0]);
      }

      // Add the remaining categories
      for (let i = 1; i < significantCategories.length; i++) {
        messageBody += `, ${formatCategory(significantCategories[i])}`;
      }

      // Add info about most frequent if not already mentioned and significant
      const mostFrequent = topByFrequency[0];
      if (!addedCategories.has(mostFrequent.groupName) && mostFrequent.count >= 15) {
        messageBody += `. Most frequent: ${formatCategory(mostFrequent)}`;
      }
    } else {
      // Fallback to simple format if no significant categories found
      messageBody = `Expense analysis: ${formatCategory(topByAmount[0])}`;

      if (topByAmount.length > 1) {
        messageBody += `, ${formatCategory(topByAmount[1])}`;
      }
    }

    // Ensure the message isn't too long for notification
    if (messageBody.length > 178) {
      // Truncate to 175 characters and add ellipsis
      messageBody = messageBody.substring(0, 175) + '...';
    }

    return messageBody;
  }
}

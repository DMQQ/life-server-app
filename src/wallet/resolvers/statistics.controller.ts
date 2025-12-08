import { Body, Controller, Get, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import { StatisticsService } from '../services/statistics.service';
import { WalletService } from '../services/wallet.service';
import { ExpensePredictionService } from '../services/expense-prediction.service';
import { User } from 'src/utils/decorators/user.decorator';
import { WalletId } from 'src/utils/decorators/wallet.decorator';
import { ExpenseType } from '../entities/wallet.entity';
import {
  CacheInterceptor,
  DefaultCacheModule,
  InvalidateCacheInterceptor,
  UserCache,
} from '../../utils/services/Cache/cache.decorator';

@UseInterceptors(CacheInterceptor, InvalidateCacheInterceptor)
@DefaultCacheModule('Wallet', { invalidateCurrentUser: true })
@UseGuards(AuthGuard)
@Controller('statistics')
export class StatisticsController {
  constructor(
    private statisticsService: StatisticsService,
    private walletService: WalletService,
    private predictionService: ExpensePredictionService,
  ) {}

  @Get('legend')
  async getStatisticsLegend(
    @WalletId() walletId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('displayMode') displayMode: 'detailed' | 'general' = 'general',
  ) {
    return this.statisticsService.legend(walletId, startDate, endDate, displayMode);
  }

  @Get('wallet-summary')
  async getWalletSummary(
    @User() userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const wallet = await this.walletService.getWalletByUserId(userId);
    const stats = await this.walletService.getStatistics(userId, [startDate, endDate]);

    return {
      wallet: {
        balance: wallet.balance,
        income: wallet.income,
        monthlyPercentageTarget: wallet.monthlyPercentageTarget,
      },
      monthlySpendings: {
        total: stats[0].total || 0,
        expense: stats[0].expense || 0,
        income: stats[0].income || 0,
      },
    };
  }

  @Get('daily-breakdown')
  async getDailyBreakdown(
    @WalletId() walletId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.statisticsService.dailyBreakdownByCategory(walletId, startDate, endDate);
  }

  @Get('recent-expenses')
  async getRecentExpenses(
    @WalletId() walletId: string,
    @Query('limit') limit: string = '4',
  ) {
    return this.statisticsService.getRecentExpenses(walletId, parseInt(limit, 10));
  }

  @Post('create-expense')
  async createExpense(
    @User() userId: string,
    @Body() body: {
      amount: number;
      description: string;
      type: 'expense' | 'income';
      category?: string;
      date?: string;
    },
  ) {
    const expenseType = body.type === 'income' ? ExpenseType.income : ExpenseType.expense;

    // Predict category if not provided and it's an expense
    let category = body.category || 'none';
    if (expenseType === ExpenseType.expense && !body.category) {
      const categoryPrediction = await this.predictionService.predictExpense(userId, body.description, body.amount);
      category = categoryPrediction ? categoryPrediction.category : 'none';
    }

    const expense = await this.walletService.createExpense(
      userId,
      body.amount,
      body.description,
      expenseType,
      category,
      new Date(),
      false,
      false,
      0,
    );

    return expense;
  }
}

import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import { StatisticsService } from '../services/statistics.service';
import { WalletService } from '../services/wallet.service';
import { User } from 'src/utils/decorators/user.decorator';
import { WalletId } from 'src/utils/decorators/wallet.decorator';
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
  ) {}

  @Get('legend')
  @UserCache(3600)
  async getStatisticsLegend(
    @WalletId() walletId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('displayMode') displayMode: 'detailed' | 'general' = 'general',
  ) {
    return this.statisticsService.legend(walletId, startDate, endDate, displayMode);
  }

  @Get('wallet-summary')
  @UserCache(3600)
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
        expense: stats[0].expense,
      },
    };
  }
}

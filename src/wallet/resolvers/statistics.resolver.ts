import { Resolver, Query, Args } from '@nestjs/graphql';
import { User } from 'src/utils/decorators/user.decorator';
import {
  MonthlyLimitResult,
  StatisticsDailySpendings,
  StatisticsDayOfWeekComparison,
  StatisticsLegend,
  ZeroExpenseDays,
} from '../types/wallet.schemas';
import { StatisticsService } from '../services/statistics.service';
import {
  CacheInterceptor,
  DefaultCacheModule,
  InvalidateCacheInterceptor,
  UserCache,
} from '../../utils/services/Cache/cache.decorator';
import { UseInterceptors } from '@nestjs/common';
import { WalletId } from 'src/utils/decorators/wallet.decorator';

@UseInterceptors(CacheInterceptor, InvalidateCacheInterceptor)
@DefaultCacheModule('Wallet', { invalidateCurrentUser: true })
@Resolver()
export class StatisticsResolver {
  constructor(private statisticsService: StatisticsService) {}

  @Query(() => [StatisticsLegend])
  @UserCache(3600)
  async statisticsLegend(
    @WalletId() walletId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @Args('displayMode') displayMode: 'detailed' | 'general',
  ) {
    return this.statisticsService.legend(walletId, startDate, endDate, displayMode);
  }

  @Query(() => [StatisticsDayOfWeekComparison])
  @UserCache(3600)
  async statisticsDayOfWeek(
    @WalletId() walletId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    return this.statisticsService.dayOfWeek(walletId, startDate, endDate);
  }

  @Query(() => [StatisticsDailySpendings])
  @UserCache(3600)
  async statisticsDailySpendings(
    @WalletId() walletId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    return this.statisticsService.spendingsByDay(walletId, startDate, endDate);
  }

  @Query(() => ZeroExpenseDays)
  @UserCache(7200)
  async statisticsZeroExpenseDays(
    @WalletId() walletId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    const [days, avg, streak] = await Promise.all([
      this.statisticsService.zeroExpensesDays(walletId, startDate, endDate),
      this.statisticsService.avgSpendingsInRange(walletId, startDate, endDate),
      this.statisticsService.noSpendingsStreaks(walletId, startDate, endDate),
    ]);

    const saved = days.length * avg;

    return {
      days,
      avg,
      streak,
      saved,
    };
  }

  @Query(() => [MonthlyLimitResult])
  @UserCache(7200)
  async statisticsSpendingsLimits(
    @User() userId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    return this.statisticsService.spendingsLimits(userId, startDate, endDate);
  }
}

import { Resolver, Query, Args } from '@nestjs/graphql';
import { User } from 'src/utils/decorators/User';
import { StatisticsDailySpendings, StatisticsDayOfWeekComparison, StatisticsLegend } from './wallet.schemas';
import { StatisticsService } from './statistics.service';
import {
  Cache,
  CacheInterceptor,
  InvalidateCacheInterceptor,
  UserCache,
} from '../utils/services/Cache/cache.decorator';
import { UseInterceptors } from '@nestjs/common';

@UseInterceptors(CacheInterceptor, InvalidateCacheInterceptor)
@Resolver()
export class StatisticsResolver {
  constructor(private statisticsService: StatisticsService) {}

  @Query(() => [StatisticsLegend])
  @UserCache(3600)
  async statisticsLegend(
    @User() userId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @Args('displayMode') displayMode: 'detailed' | 'general',
  ) {
    return this.statisticsService.legend(userId, startDate, endDate, displayMode);
  }

  @Query(() => [StatisticsDayOfWeekComparison])
  @UserCache(3600)
  async statisticsDayOfWeek(
    @User() userId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    return this.statisticsService.dayOfWeek(userId, startDate, endDate);
  }

  @Query(() => [StatisticsDailySpendings])
  @UserCache(3600)
  async statisticsDailySpendings(
    @User() userId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    return this.statisticsService.spendingsByDay(userId, startDate, endDate);
  }
}

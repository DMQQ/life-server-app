import { Resolver, Query, Args } from '@nestjs/graphql';
import { User } from 'src/utils/decorators/User';
import { StatisticsDailySpendings, StatisticsDayOfWeekComparison, StatisticsLegend } from './wallet.schemas';
import { StatisticsService } from './statistics.service';

@Resolver()
export class StatisticsResolver {
  constructor(private statisticsService: StatisticsService) {}

  @Query(() => [StatisticsLegend])
  async statisticsLegend(
    @User() userId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @Args('displayMode') displayMode: 'detailed' | 'general',
  ) {
    return this.statisticsService.legend(userId, startDate, endDate, displayMode);
  }

  @Query(() => [StatisticsDayOfWeekComparison])
  async statisticsDayOfWeek(
    @User() userId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    return this.statisticsService.dayOfWeek(userId, startDate, endDate);
  }

  @Query(() => [StatisticsDailySpendings])
  async statisticsDailySpendings(
    @User() userId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    return this.statisticsService.spendingsByDay(userId, startDate, endDate);
  }
}

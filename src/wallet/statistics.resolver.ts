import { Resolver, Query, Args } from '@nestjs/graphql';

import { User } from 'src/utils/decorators/User';
import * as moment from 'moment';
import { StatisticsLegend } from './wallet.schemas';
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
    return this.statisticsService.legend(userId, moment(startDate).toDate(), moment(endDate).toDate(), displayMode);
  }
}

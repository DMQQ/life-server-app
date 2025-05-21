import { Resolver, Query, Args } from '@nestjs/graphql';
import { StatisticsService } from './statistics.service';
import { User } from 'src/utils/decorators/User';
import * as moment from 'moment';
import { StatisticsLegend } from './wallet.schemas';

@Resolver()
export class StatisticsResolver {
  constructor(private statisticsService: StatisticsService) {}

  @Query(() => [StatisticsLegend])
  async statisticsLegend(
    @User() userId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    return this.statisticsService.legend(userId, moment(startDate).toDate(), moment(endDate).toDate());
  }
}

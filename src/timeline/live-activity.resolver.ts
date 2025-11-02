import { UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, Field, ID, InputType, Mutation, Resolver } from '@nestjs/graphql';
import { User } from 'src/utils/decorators/user.decorator';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import {
  CacheInterceptor,
  DefaultCacheModule,
  InvalidateCacheInterceptor,
} from 'src/utils/services/Cache/cache.decorator';
import { LiveActivityEntity } from './live-activity.entity';
import { LiveActivityService } from './live-activity.service';

@InputType()
class SetUpdateTokenInput {
  @Field(() => ID)
  activityId: string;

  @Field(() => String)
  updateToken: string;
}

@UseGuards(AuthGuard)
@UseInterceptors(CacheInterceptor, InvalidateCacheInterceptor)
@DefaultCacheModule('LiveActivity', { invalidateCurrentUser: true })
@Resolver(() => LiveActivityEntity)
export class LiveActivityResolver {
  constructor(private liveActivityService: LiveActivityService) {}

  @Mutation(() => LiveActivityEntity)
  async setLiveActivityUpdateToken(
    @Args('input') input: SetUpdateTokenInput,
    @User() userId: string,
  ): Promise<LiveActivityEntity> {
    // Try to find by activity ID first
    let activity = await this.liveActivityService.findById(input.activityId);
    
    // If not found, try to find by timeline ID (for remote activities)
    if (!activity) {
      activity = await this.liveActivityService.findActivityByTimelineId(input.activityId);
    }
    
    if (!activity) {
      throw new Error(`Live activity not found for ID: ${input.activityId}`);
    }

    return this.liveActivityService.setUpdateToken(activity.id, input.updateToken);
  }
}
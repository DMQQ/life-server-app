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

  @Field(() => String, { nullable: true })
  occurrenceId?: string;
}

@UseGuards(AuthGuard)
@UseInterceptors(CacheInterceptor, InvalidateCacheInterceptor)
@DefaultCacheModule('LiveActivity', { invalidateCurrentUser: true })
@Resolver(() => LiveActivityEntity)
export class LiveActivityResolver {
  constructor(private liveActivityService: LiveActivityService) {}

  @Mutation(() => Boolean)
  async setLiveActivityUpdateToken(
    @Args('input') input: SetUpdateTokenInput,
    @User() userId: string,
  ): Promise<Boolean> {
    try {
      let activity: LiveActivityEntity | null = null;

      if (input.occurrenceId) {
        activity = await this.liveActivityService.findActivityByOccurrenceId(input.occurrenceId);
      }

      if (!activity) {
        activity = await this.liveActivityService.findById(input.activityId);
      }

      if (!activity) {
        console.error(`No live activity found for activityId: ${input.activityId}, occurrenceId: ${input.occurrenceId}`);
        return false;
      }

      await this.liveActivityService.setUpdateToken(activity.id, input.updateToken);
      console.log(`Successfully set update token for Live Activity ${activity.id} (occurrence: ${activity.occurrenceId})`);
      return true;
    } catch (error) {
      console.error('Error setting Live Activity update token:', error);
      return false;
    }
  }
}

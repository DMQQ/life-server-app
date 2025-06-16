import { Args, Field, InputType, Mutation, Resolver, Query, Int, ID } from '@nestjs/graphql';
import { NotificationsService } from './notifications.service';
import { User } from 'src/utils/decorators/user.decorator';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import Expo from 'expo-server-sdk';
import { NotificationsHistoryEntity } from './notifications.entity';

@UseGuards(AuthGuard)
@Resolver()
export class NotificationsResolver {
  constructor(private notificationsService: NotificationsService) {}

  @Mutation(() => Boolean)
  async setNotificationsToken(@User() usr: string, @Args('token') token: string) {
    if (!Expo.isExpoPushToken(token)) throw new BadRequestException('Invalid token format');

    const userToken = await this.notificationsService.create(token, usr);

    return true;
  }

  @Query(() => [NotificationsHistoryEntity])
  notifications(
    @User() user: string,
    @Args('skip', { type: () => Int }) skip = 0,
    @Args('take', { type: () => Int }) take = 25,
  ) {
    return this.notificationsService.findNotifications(user, skip, take);
  }

  @Mutation(() => Boolean)
  async readNotification(@Args('id', { type: () => ID }) id: string) {
    return (await this.notificationsService.readNotification(id)).affected > 0;
  }

  @Mutation(() => [NotificationsHistoryEntity, Number])
  async unreadNotifications(@User() user: string) {
    return this.notificationsService.unreadNotifications(user);
  }
}

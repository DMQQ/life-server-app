import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import Expo from 'expo-server-sdk';
import GraphQLJSON from 'graphql-type-json';
import { User } from 'src/utils/decorators/user.decorator';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import { NotificationsEntity, NotificationsHistoryEntity } from './notifications.entity';
import { NotificationsService } from './notifications.service';
import { NotificationTypeDto } from './dto/notification-type.dto';

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

  @Mutation(() => Boolean)
  async readAllNotifications(@User() userId: string) {
    return (await this.notificationsService.readAll(userId)).affected > 0;
  }

  @Query(() => NotificationsEntity)
  async getNotificationSettings(@User() userId: string) {
    const userToken = await this.notificationsService.findUserToken(userId);
    return userToken;
  }

  @Mutation(() => NotificationsEntity)
  async toggleEnabledNotifications(
    @Args('input', { type: () => GraphQLJSON }) input: Record<string, boolean>,
    @User() userId: string,
  ) {
    const notifications = await this.notificationsService.toggleEnabledNotifications(userId, input);

    return notifications;
  }

  @Query(() => [NotificationTypeDto])
  async getAvailableNotificationTypes() {
    return this.notificationsService.getAvailableNotificationTypes();
  }

  @Mutation(() => Boolean)
  async setPushToStartToken(
    @Args('pushToStartToken', { type: () => String }) pushToStartToken: string,
    @User() userId: string,
  ) {
    try {
      const result = await this.notificationsService.setPushToStartToken(userId, pushToStartToken);

      return result.affected > 0;
    } catch (error) {
      return false;
    }
  }
}

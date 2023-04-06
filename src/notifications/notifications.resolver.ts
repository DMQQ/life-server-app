import { Args, Field, InputType, Mutation, Resolver } from '@nestjs/graphql';
import { NotificationsService } from './notifications.service';
import { User } from 'src/utils/decorators/User';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import Expo from 'expo-server-sdk';

@UseGuards(AuthGuard)
@Resolver()
export class NotificationsResolver {
  constructor(private notificationsService: NotificationsService) {}

  @Mutation(() => Boolean)
  async setNotificationsToken(
    @User() usr: string,
    @Args('token') token: string,
  ) {
    if (!Expo.isExpoPushToken(token))
      throw new BadRequestException('Invalid token format');

    const userToken = await this.notificationsService.create(token, usr);

    return true;
  }
}

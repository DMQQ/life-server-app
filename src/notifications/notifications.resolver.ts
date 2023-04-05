import { Args, Field, InputType, Mutation, Resolver } from '@nestjs/graphql';
import { NotificationsService } from './notifications.service';
import { User } from 'src/utils/decorators/User';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/utils/guards/AuthGuard';

@UseGuards(AuthGuard)
@Resolver()
export class NotificationsResolver {
  constructor(private notificationsService: NotificationsService) {}

  @Mutation(() => Boolean)
  async setNotificationsToken(
    @User() usr: string,
    @Args('token') token: string,
  ) {
    const userToken = await this.notificationsService.create(token, usr);

    return true;
  }
}

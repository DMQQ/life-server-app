import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsEntity, NotificationsHistoryEntity } from 'src/notifications/notifications.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';
import { ApnService } from './apn.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationsEntity, NotificationsHistoryEntity])],
  providers: [NotificationsService, NotificationsResolver, ApnService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

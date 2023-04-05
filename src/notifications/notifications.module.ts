import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsEntity } from 'src/entities/notifications.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationsEntity])],
  providers: [NotificationsService, NotificationsResolver],
  exports: [NotificationsService],
})
export class NotificationsModule {}

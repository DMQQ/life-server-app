import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TimelineEntity,
  TimelineFilesEntity,
  TimelineTodosEntity,
  TodoFilesEntity,
} from 'src/timeline/timeline.entity';
import { TimelineService } from './timeline.service';
import { TimelineResolver } from './timeline.resolver';
import { TimelineSchedule } from './timeline.schedule';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TimelineScheduleService } from './timelineSchedule.service';
import { WalletModule } from '../wallet/wallet.module';
import { TimelineSubscriber } from './timeline.subscriber';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimelineEntity, TimelineFilesEntity, TimelineTodosEntity, TodoFilesEntity]),
    NotificationsModule,
    WalletModule,
  ],
  providers: [TimelineService, TimelineResolver, TimelineSchedule, TimelineScheduleService, TimelineSubscriber],
})
export class TimelineModule {}

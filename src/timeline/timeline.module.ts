import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TimelineEntity,
  TimelineFilesEntity,
  TimelineTodosEntity,
  TodoFilesEntity,
} from 'src/timeline/timeline.entity';
import { LiveActivityEntity } from './live-activity.entity';
import { TimelineService } from './timeline.service';
import { TimelineResolver } from './timeline.resolver';
import { LiveActivityService } from './live-activity.service';
import { LiveActivityResolver } from './live-activity.resolver';
import { TimelineSchedule } from './timeline.schedule';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TimelineScheduleService } from './timelineSchedule.service';
import { WalletModule } from '../wallet/wallet.module';
import { TimelineTodosSubscriber, TimelineSubscriber } from './timeline.subscriber';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimelineEntity, TimelineFilesEntity, TimelineTodosEntity, TodoFilesEntity, LiveActivityEntity]),
    NotificationsModule,
    WalletModule,
  ],
  providers: [TimelineService, TimelineResolver, TimelineSchedule, TimelineScheduleService, TimelineTodosSubscriber, TimelineSubscriber, LiveActivityService, LiveActivityResolver],
})
export class TimelineModule {}

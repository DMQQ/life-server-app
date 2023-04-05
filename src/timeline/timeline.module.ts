import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TimelineEntity,
  TimelineFilesEntity,
  TimelineTodosEntity,
} from 'src/entities/timeline.entity';
import { TimelineService } from './timeline.service';
import { TimelineResolver } from './timeline.resolver';
import { TimelineSchedule } from './timeline.schedule';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TimelineScheduleService } from './timelineSchedule.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TimelineEntity,
      TimelineFilesEntity,
      TimelineTodosEntity,
    ]),
    NotificationsModule,
  ],
  providers: [
    TimelineService,
    TimelineResolver,
    TimelineSchedule,
    TimelineScheduleService,
  ],
})
export class TimelineModule {}

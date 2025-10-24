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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TimelineEntity,
      TimelineFilesEntity,
      TimelineTodosEntity,
      TodoFilesEntity,
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

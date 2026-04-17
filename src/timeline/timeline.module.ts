import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventSeriesEntity } from './entities/event-series.entity';
import { EventOccurrenceEntity } from './entities/event-occurrence.entity';
import { OccurrenceTodoEntity, TodoFilesEntity } from './entities/occurrence-todo.entity';
import { OccurrenceFileEntity } from './entities/occurrence-file.entity';
import { LiveActivityEntity } from './live-activity.entity';
import { EventSeriesService } from './event-series.service';
import { EventOccurrenceService } from './event-occurrence.service';
import { EventOccurrenceResolver } from './event-occurrence.resolver';
import { LiveActivityService } from './live-activity.service';
import { LiveActivityResolver } from './live-activity.resolver';
import { TimelineSchedule } from './timeline.schedule';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TimelineScheduleService } from './timelineSchedule.service';
import { WalletModule } from '../wallet/wallet.module';
import { TimelineListener } from './timeline.listener';
import { ApnService } from 'src/notifications/apn.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventSeriesEntity,
      EventOccurrenceEntity,
      OccurrenceTodoEntity,
      TodoFilesEntity,
      OccurrenceFileEntity,
      LiveActivityEntity,
    ]),
    NotificationsModule,
    WalletModule,
  ],
  providers: [
    EventSeriesService,
    EventOccurrenceService,
    EventOccurrenceResolver,
    TimelineSchedule,
    TimelineScheduleService,
    LiveActivityService,
    LiveActivityResolver,
    TimelineListener,
    ApnService,
  ],
  exports: [EventSeriesService, EventOccurrenceService, LiveActivityService],
})
export class TimelineModule {}

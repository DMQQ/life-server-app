import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as moment from 'moment';
import { TimelineEntity } from 'src/entities/timeline.entity';
import { Like, Repository } from 'typeorm';

@Injectable()
export class TimelineScheduleService {
  constructor(
    @InjectRepository(TimelineEntity)
    private timelineRepository: Repository<TimelineEntity>,
  ) {}

  async findEventsWithDateAndTime(date: string, time: string) {
    return this.timelineRepository.find({
      where: { date: date, beginTime: time },
    });
  }

  async findEndingEvents(date: string, time: string) {
    const afterAnHour = moment(time, 'HH:mm:ss')
      .add(1, 'hours')
      .format('HH:mm:ss');

    return this.timelineRepository.find({
      where: [
        {
          date: Like(`%${date}%`),
          endTime: time,
          isCompleted: false,
          notification: true,
        },
        {
          date: Like(`%${date}%`),
          endTime: afterAnHour,
          isCompleted: false,
          notification: true,
        },
      ],
    });
  }
}

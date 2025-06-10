import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TimelineEntity } from 'src/timeline/timeline.entity';
import { Like, Repository } from 'typeorm';

interface FindEventsResponse {
  title: string;
  description: string;
  token: string;
  isEnable: boolean;
  beginTime: string;
  endTime: string;
  id: string;
}

@Injectable()
export class TimelineScheduleService {
  constructor(
    @InjectRepository(TimelineEntity)
    private timelineRepository: Repository<TimelineEntity>,
  ) {}

  async findEventsByTypeWithCurrentTime(type: 'beginTime' | 'endTime'): Promise<FindEventsResponse[]> {
    return this.timelineRepository.query(
      `
      SELECT 
        t.id, t.title, t.description, n.token, n.isEnable, t.beginTime, t.endTime
      FROM timeline as t
        LEFT JOIN notifications as n ON t.userId = n.userId
      WHERE FIND_IN_SET(CURDATE(), REPLACE(t.date, ';', ',')) > 0
        AND ${type} = TIME_FORMAT(CURTIME(), '%H:%i:00')
        AND notification = 1
        AND isCompleted = 0
        AND (n.token IS NOT NULL OR n.token != "")
        AND n.isEnable = 1
    `,
      [],
    );
  }
}

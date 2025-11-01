import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TimelineEntity } from 'src/timeline/timeline.entity';
import { Like, Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import * as timezone from 'dayjs/plugin/timezone';
import * as utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

interface FindEventsResponse {
  title: string;
  description: string;
  token: string;
  isEnable: boolean;
  beginTime: string;
  endTime: string;
  id: string;
  userId: string;
}

interface TodoResponse {
  id: string;
  title: string;
  isCompleted: boolean;
  userId: string;
}

@Injectable()
export class TimelineScheduleService {
  constructor(
    @InjectRepository(TimelineEntity)
    private timelineRepository: Repository<TimelineEntity>,
  ) {}

  async findEventsByTypeWithCurrentTime(type: 'beginTime' | 'endTime'): Promise<FindEventsResponse[]> {
    const warsawTime = dayjs().tz('Europe/Warsaw');
    const currentDate = warsawTime.format('YYYY-MM-DD');
    const currentTime = warsawTime.format('HH:mm:ss');

    console.log(`Current Warsaw Date: ${currentDate}, Time: ${currentTime}`);

    return this.timelineRepository.query(
      `
      SELECT 
        t.id, t.title, t.description, n.token, n.isEnable, t.beginTime, t.endTime, t.userId
      FROM timeline as t
        LEFT JOIN notifications as n ON t.userId = n.userId
      WHERE FIND_IN_SET(?, REPLACE(t.date, ';', ',')) > 0
        AND ${type} = ?
        AND notification = 1
        AND isCompleted = 0
        AND (n.token IS NOT NULL OR n.token != "")
        AND n.isEnable = 1
    `,
      [currentDate, currentTime],
    );
  }

  async getUncompletedTodosForUser(timelineId: string): Promise<TodoResponse[]> {
    return this.timelineRepository.query(
      `
      SELECT 
        tt.id, tt.title, tt.isCompleted, t.userId
      FROM timeline_todos as tt
        INNER JOIN timeline as t ON tt.timelineId = t.id
      WHERE t.id = ?
        AND tt.isCompleted = 0
      ORDER BY tt.createdAt DESC
      LIMIT 20
    `,
      [timelineId],
    );
  }
}

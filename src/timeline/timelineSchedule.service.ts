import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import * as timezone from 'dayjs/plugin/timezone';
import * as utc from 'dayjs/plugin/utc';
import { EventOccurrenceEntity } from './entities/event-occurrence.entity';

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
    @InjectRepository(EventOccurrenceEntity)
    private occurrenceRepo: Repository<EventOccurrenceEntity>,
  ) {}

  async findEventsByTypeWithCurrentTime(type: 'beginTime' | 'endTime'): Promise<FindEventsResponse[]> {
    const warsawTime = dayjs().tz('Europe/Warsaw');
    const currentDate = warsawTime.format('YYYY-MM-DD');
    const currentTime = warsawTime.format('HH:mm:ss');

    const timeField =
      type === 'beginTime' ? 'COALESCE(o.beginTimeOverride, s.beginTime)' : 'COALESCE(o.endTimeOverride, s.endTime)';

    return this.occurrenceRepo.query(
      `
      SELECT
        o.id,
        COALESCE(o.titleOverride, s.title) as title,
        COALESCE(o.descriptionOverride, s.description) as description,
        n.token, n.isEnable,
        COALESCE(o.beginTimeOverride, s.beginTime) as beginTime,
        COALESCE(o.endTimeOverride, s.endTime) as endTime,
        s.userId, o.isCompleted
      FROM event_occurrence as o
        INNER JOIN event_series as s ON o.seriesId = s.id
        LEFT JOIN notifications as n ON s.userId = n.userId
      WHERE o.date = ?
        AND ${timeField} = ?
        AND s.notification = 1
        AND o.isCompleted = 0
        AND o.isSkipped = 0
        AND (n.token IS NOT NULL AND n.token != "")
        AND n.isEnable = 1
    `,
      [currentDate, currentTime],
    );
  }

  async findExpiredEvents(): Promise<{ id: string; title: string; userId: string; token: string }[]> {
    const warsawTime = dayjs().tz('Europe/Warsaw');
    const today = warsawTime.format('YYYY-MM-DD');
    const twoDaysAgo = warsawTime.subtract(2, 'day').format('YYYY-MM-DD');

    return this.occurrenceRepo.query(
      `
      SELECT
        o.id,
        COALESCE(o.titleOverride, s.title) as title,
        s.userId,
        n.token
      FROM event_occurrence as o
        INNER JOIN event_series as s ON o.seriesId = s.id
        LEFT JOIN notifications as n ON s.userId = n.userId
      WHERE o.date >= ?
        AND o.date < ?
        AND o.isCompleted = 0
        AND o.isSkipped = 0
        AND s.notification = 1
        AND (n.token IS NOT NULL AND n.token != "")
        AND n.isEnable = 1
      ORDER BY s.userId, o.date DESC
    `,
      [twoDaysAgo, today],
    );
  }

  async getUncompletedTodosForUser(occurrenceId: string): Promise<TodoResponse[]> {
    return this.occurrenceRepo.query(
      `
      SELECT
        ot.id, ot.title, ot.isCompleted, s.userId
      FROM occurrence_todos as ot
        INNER JOIN event_occurrence as o ON ot.occurrenceId = o.id
        INNER JOIN event_series as s ON o.seriesId = s.id
      WHERE o.id = ?
        AND ot.isCompleted = 0
      ORDER BY ot.createdAt DESC
      LIMIT 20
    `,
      [occurrenceId],
    );
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import * as timezone from 'dayjs/plugin/timezone';
import * as utc from 'dayjs/plugin/utc';
import { EventOccurrenceEntity } from './entities/event-occurrence.entity';
import { EventSeriesEntity } from './entities/event-series.entity';
import { expandSeriesDates, SeriesRecurrenceConfig } from './recurrence-engine';

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
  reminderBeforeMinutes?: number;
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

    @InjectRepository(EventSeriesEntity)
    private seriesRepo: Repository<EventSeriesEntity>,
  ) {}

  async findEventsByTypeWithCurrentTime(type: 'beginTime' | 'endTime'): Promise<FindEventsResponse[]> {
    const warsawTime = dayjs().tz('Europe/Warsaw');
    const currentDate = warsawTime.format('YYYY-MM-DD');
    const currentTime = warsawTime.format('HH:mm:ss');

    const timeField =
      type === 'beginTime' ? 'COALESCE(o.beginTimeOverride, s.beginTime)' : 'COALESCE(o.endTimeOverride, s.endTime)';

    // 1. Real occurrence rows (non-recurring + exceptions)
    const realEvents: (FindEventsResponse & { seriesId: string })[] = await this.occurrenceRepo.query(
      `
      SELECT
        o.id,
        s.id as seriesId,
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

    // Track which series already have a real row on this date
    const coveredSeriesIds = new Set(realEvents.map((e) => e.seriesId));

    // 2. Find recurring series with virtual occurrences on currentDate
    const recurringSeries = await this.seriesRepo.find({
      where: { isRepeat: true, notification: true },
    });

    const virtualEvents: FindEventsResponse[] = [];

    for (const series of recurringSeries) {
      // Skip if we already have a real row for this series on this date
      if (coveredSeriesIds.has(series.id)) continue;

      // Get anchor date
      const anchorOcc = await this.occurrenceRepo.findOne({
        where: { seriesId: series.id },
        order: { position: 'ASC' },
      });
      if (!anchorOcc || !anchorOcc.date) continue;

      // Skip if this series has a skipped exception row for today
      const skippedRow = await this.occurrenceRepo.findOne({
        where: { seriesId: series.id, date: currentDate, isSkipped: true },
      });
      if (skippedRow) continue;

      // Check if currentDate falls within recurrence pattern
      const config: SeriesRecurrenceConfig = {
        repeatType: series.repeatType || (series.repeatFrequency || 'daily').toUpperCase(),
        repeatInterval: series.repeatInterval || series.repeatEveryNth || 1,
        repeatDaysOfWeek: series.repeatDaysOfWeek || null,
        repeatUntil: series.repeatUntil || null,
      };

      const dates = expandSeriesDates(config, anchorOcc.date, currentDate, currentDate);
      if (dates.length === 0) continue;

      // Check if time matches (using series defaults since no override for virtual)
      const timeToCheck = type === 'beginTime' ? series.beginTime : series.endTime;
      if (timeToCheck !== currentTime) continue;

      // Check for a completed exception row
      const completedRow = await this.occurrenceRepo.findOne({
        where: { seriesId: series.id, date: currentDate, isCompleted: true },
      });
      if (completedRow) continue;

      // Get user token
      const tokenRow = await this.occurrenceRepo.query(
        `SELECT n.token, n.isEnable FROM notifications n WHERE n.userId = ? AND n.isEnable = 1 AND n.token IS NOT NULL AND n.token != ""`,
        [series.userId],
      );

      if (tokenRow.length === 0) continue;

      virtualEvents.push({
        id: `${series.id}_${currentDate}`, // synthetic ID
        title: series.title,
        description: series.description,
        token: tokenRow[0].token,
        isEnable: tokenRow[0].isEnable,
        beginTime: series.beginTime,
        endTime: series.endTime,
        userId: series.userId,
      });
    }

    return [...realEvents, ...virtualEvents];
  }

  /**
   * Find events whose end time was exactly 15 or 30 minutes ago (today, Warsaw
   * time) and that are still incomplete. Used to send "missed event" push
   * notifications shortly after an event passes.
   */
  async findExpiredEvents(): Promise<{ id: string; title: string; userId: string; token: string }[]> {
    const warsawTime = dayjs().tz('Europe/Warsaw');
    const today = warsawTime.format('YYYY-MM-DD');
    const minus15 = warsawTime.subtract(15, 'minute').format('HH:mm:ss');
    const minus30 = warsawTime.subtract(30, 'minute').format('HH:mm:ss');

    // Real rows – match events that ended exactly 15 or 30 minutes ago today
    const realEvents = await this.occurrenceRepo.query(
      `
      SELECT
        o.id,
        COALESCE(o.titleOverride, s.title) as title,
        s.userId,
        n.token
      FROM event_occurrence as o
        INNER JOIN event_series as s ON o.seriesId = s.id
        LEFT JOIN notifications as n ON s.userId = n.userId
      WHERE o.date = ?
        AND COALESCE(o.endTimeOverride, s.endTime) IN (?, ?)
        AND o.isCompleted = 0
        AND o.isSkipped = 0
        AND s.notification = 1
        AND (n.token IS NOT NULL AND n.token != "")
        AND n.isEnable = 1
    `,
      [today, minus15, minus30],
    );

    // Virtual occurrences from recurring series
    const recurringSeries = await this.seriesRepo.find({
      where: { isRepeat: true, notification: true },
    });

    const virtualResults: { id: string; title: string; userId: string; token: string }[] = [];

    for (const series of recurringSeries) {
      // Only process if the series end time matches one of our windows
      if (series.endTime !== minus15 && series.endTime !== minus30) continue;

      const anchorOcc = await this.occurrenceRepo.findOne({
        where: { seriesId: series.id },
        order: { position: 'ASC' },
      });
      if (!anchorOcc || !anchorOcc.date) continue;

      const config: SeriesRecurrenceConfig = {
        repeatType: series.repeatType || (series.repeatFrequency || 'daily').toUpperCase(),
        repeatInterval: series.repeatInterval || series.repeatEveryNth || 1,
        repeatDaysOfWeek: series.repeatDaysOfWeek || null,
        repeatUntil: series.repeatUntil || null,
      };

      const dates = expandSeriesDates(config, anchorOcc.date, today, today);
      if (dates.length === 0) continue;

      // Get user token
      const tokenRow = await this.occurrenceRepo.query(
        `SELECT n.token FROM notifications n WHERE n.userId = ? AND n.isEnable = 1 AND n.token IS NOT NULL AND n.token != ""`,
        [series.userId],
      );
      if (tokenRow.length === 0) continue;

      // Skip if a real exception row already marks it completed or skipped
      const exception = await this.occurrenceRepo.findOne({
        where: { seriesId: series.id, date: today },
      });
      if (exception?.isCompleted || exception?.isSkipped) continue;

      virtualResults.push({
        id: `${series.id}_${today}`,
        title: series.title,
        userId: series.userId,
        token: tokenRow[0].token,
      });
    }

    return [...realEvents, ...virtualResults];
  }

  /**
   * Find events that have a reminderBeforeMinutes set and should fire now.
   * Checks if (beginTime - reminderBeforeMinutes) matches current time.
   */
  async findEventsWithReminderBefore(): Promise<FindEventsResponse[]> {
    const warsawTime = dayjs().tz('Europe/Warsaw');
    const currentDate = warsawTime.format('YYYY-MM-DD');

    // Find all series with reminderBeforeMinutes set
    const seriesList = await this.seriesRepo.find({
      where: { isRepeat: true, notification: true },
    });

    const results: FindEventsResponse[] = [];

    for (const series of seriesList) {
      if (!series.reminderBeforeMinutes || !series.beginTime) continue;

      // Calculate when the reminder should fire
      const eventTime = dayjs.tz(`${currentDate} ${series.beginTime}`, 'Europe/Warsaw');
      const reminderTime = eventTime.subtract(series.reminderBeforeMinutes, 'minute');

      // Check if current time matches reminder time
      const now = warsawTime;
      const diffMinutes = now.diff(reminderTime, 'minute');

      // Allow 1-minute window (cron runs every minute)
      if (diffMinutes !== 0) continue;

      // Check if this series has an occurrence on currentDate
      const anchorOcc = await this.occurrenceRepo.findOne({
        where: { seriesId: series.id },
        order: { position: 'ASC' },
      });
      if (!anchorOcc || !anchorOcc.date) continue;

      const config: SeriesRecurrenceConfig = {
        repeatType: series.repeatType || (series.repeatFrequency || 'daily').toUpperCase(),
        repeatInterval: series.repeatInterval || series.repeatEveryNth || 1,
        repeatDaysOfWeek: series.repeatDaysOfWeek || null,
        repeatUntil: series.repeatUntil || null,
      };

      const dates = expandSeriesDates(config, anchorOcc.date, currentDate, currentDate);
      if (dates.length === 0) continue;

      // Check not completed or skipped
      const exception = await this.occurrenceRepo.findOne({
        where: { seriesId: series.id, date: currentDate },
      });
      if (exception?.isCompleted || exception?.isSkipped) continue;

      // Get user token
      const tokenRow = await this.occurrenceRepo.query(
        `SELECT n.token, n.isEnable FROM notifications n WHERE n.userId = ? AND n.isEnable = 1 AND n.token IS NOT NULL AND n.token != ""`,
        [series.userId],
      );
      if (tokenRow.length === 0) continue;

      results.push({
        id: `${series.id}_${currentDate}`,
        title: series.title,
        description: series.description,
        token: tokenRow[0].token,
        isEnable: tokenRow[0].isEnable,
        beginTime: series.beginTime,
        endTime: series.endTime,
        userId: series.userId,
        reminderBeforeMinutes: series.reminderBeforeMinutes,
      });
    }

    return results;
  }

  async getUncompletedTodosForUser(occurrenceId: string): Promise<TodoResponse[]> {
    // Handle synthetic IDs
    let realId = occurrenceId;
    if (occurrenceId.includes('_') && occurrenceId.length > 36) {
      const parts = occurrenceId.split('_');
      if (parts.length >= 2) {
        const seriesId = parts[0];
        const date = parts.slice(1).join('_');
        const occ = await this.occurrenceRepo.findOne({
          where: { seriesId, date },
        });
        if (occ) {
          realId = occ.id;
        } else {
          return []; // Virtual occurrence with no real row has no todos
        }
      }
    }

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
      [realId],
    );
  }
}

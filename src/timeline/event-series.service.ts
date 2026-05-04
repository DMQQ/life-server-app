import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventSeriesEntity } from './entities/event-series.entity';
import { EventOccurrenceEntity } from './entities/event-occurrence.entity';
import { CreateEventInput, RepeatInput } from './timeline.schemas';

function excludeSeconds(time: string): string {
  return [...time.split(':').slice(0, 2), '00'].join(':');
}

@Injectable()
export class EventSeriesService {
  constructor(
    @InjectRepository(EventSeriesEntity)
    private seriesRepo: Repository<EventSeriesEntity>,

    @InjectRepository(EventOccurrenceEntity)
    private occurrenceRepo: Repository<EventOccurrenceEntity>,
  ) {}

  async createSeries(
    input: CreateEventInput & { userId: string },
    repeat?: RepeatInput,
  ): Promise<{ series: EventSeriesEntity; occurrences: EventOccurrenceEntity[] }> {
    const isRepeat = !!(repeat?.repeatType || repeat?.repeatOn);
    const anchorDate = repeat?.startDate || input.date || null;

    const series = await this.seriesRepo.save({
      title: input.title,
      description: input.description,
      beginTime: excludeSeconds(input.beginTime),
      endTime: excludeSeconds(input.endTime),
      tags: input.tags,
      userId: input.userId,
      isAllDay: false,
      isRepeat,
      priority: input.priority ?? 0,
      ...(isRepeat && {
        // New recurrence fields
        repeatType: repeat.repeatType || (repeat.repeatOn ? repeat.repeatOn.toUpperCase() : null),
        repeatDaysOfWeek: repeat.repeatDaysOfWeek?.join(',') || null,
        repeatInterval: repeat.repeatInterval || repeat.repeatEveryNth || 1,
        repeatUntil: repeat.repeatUntil || null,
        reminderBeforeMinutes: repeat.reminderBeforeMinutes || null,
        // Legacy fields for backward compat
        repeatFrequency: repeat.repeatOn || null,
        repeatEveryNth: repeat.repeatEveryNth || null,
        repeatCount: repeat.repeatCount || null,
      }),
    });

    // Create only the anchor occurrence (one row). Virtual occurrences
    // for other dates are generated on-the-fly by the recurrence engine.
    const occurrences = await this.occurrenceRepo.save([
      {
        seriesId: series.id,
        date: anchorDate,
        position: 0,
        isException: false,
      },
    ]);

    return { series, occurrences };
  }

  async updateSeriesFields(
    seriesId: string,
    input: Partial<Pick<EventSeriesEntity, 'title' | 'description' | 'beginTime' | 'endTime' | 'tags' | 'priority'>>,
  ): Promise<EventSeriesEntity> {
    const update: any = { ...input };
    if (input.beginTime) update.beginTime = excludeSeconds(input.beginTime);
    if (input.endTime) update.endTime = excludeSeconds(input.endTime);

    await this.seriesRepo.update({ id: seriesId }, update);
    return this.seriesRepo.findOne({ where: { id: seriesId } });
  }

  async clearAllOverrides(seriesId: string): Promise<void> {
    await this.occurrenceRepo.update(
      { seriesId },
      {
        titleOverride: null,
        descriptionOverride: null,
        beginTimeOverride: null,
        endTimeOverride: null,
      },
    );
  }

  async deleteSeries(seriesId: string): Promise<void> {
    await this.seriesRepo.delete({ id: seriesId });
  }

  async getAnchorDate(seriesId: string): Promise<string | null> {
    const occ = await this.occurrenceRepo.findOne({
      where: { seriesId, position: 0 },
      order: { position: 'ASC' },
    });
    return occ?.date || null;
  }
}

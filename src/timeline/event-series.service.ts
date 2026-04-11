import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
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
    const isRepeat = !!(repeat?.repeatOn);

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
        repeatFrequency: repeat.repeatOn,
        repeatEveryNth: repeat.repeatEveryNth,
        repeatCount: repeat.repeatCount,
      }),
    });

    const dates: (string | null)[] = isRepeat
      ? this._generateDates(repeat.startDate || input.date, repeat.repeatCount, repeat.repeatEveryNth, repeat.repeatOn)
      : [input.date ?? null];

    const occurrences = await this.occurrenceRepo.save(
      dates.map((date, position) => ({
        seriesId: series.id,
        date,
        position,
      })),
    );

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

  private _generateDates(
    startDate: string,
    count: number,
    everyNth: number,
    frequency: string,
  ): string[] {
    const unit: dayjs.ManipulateType = frequency === 'daily' ? 'days' : 'weeks';
    const dates: string[] = [];
    for (let i = 0; i < count; i++) {
      dates.push(dayjs(startDate).add(i * everyNth, unit).format('YYYY-MM-DD'));
    }
    return dates;
  }
}

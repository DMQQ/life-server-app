import { EventOccurrenceEntity } from 'src/timeline/entities/event-occurrence.entity';
import { AiTool, buildStandardQuery, ToolContext, UniversalQueryParams } from './base.tool';

const FIELD_MAP: Record<string, string> = {
  id: 'occ.id',
  date: 'occ.date',
  isCompleted: 'occ.isCompleted',
  isSkipped: 'occ.isSkipped',
  titleOverride: 'occ.titleOverride',
  descriptionOverride: 'occ.descriptionOverride',
  beginTimeOverride: 'occ.beginTimeOverride',
  endTimeOverride: 'occ.endTimeOverride',
  title: 'series.title',
  description: 'series.description',
  tags: 'series.tags',
  priority: 'series.priority',
  isAllDay: 'series.isAllDay',
  isRepeat: 'series.isRepeat',
  repeatFrequency: 'series.repeatFrequency',
};

export class EventsTool extends AiTool {
  readonly name = 'events';
  readonly description = 'Timeline event occurrences';
  readonly fields = {
    id: 'UUID',
    date: 'YYYY-MM-DD',
    isCompleted: 'boolean',
    isSkipped: 'boolean',
    title: 'string (from series)',
    description: 'string (from series)',
    tags: 'string',
    priority: 'number',
    isAllDay: 'boolean',
    isRepeat: 'boolean',
    repeatFrequency: '"daily"|"weekly"|"monthly"',
    titleOverride: 'string (overrides series title for this occurrence)',
    beginTimeOverride: 'time HH:mm',
    endTimeOverride: 'time HH:mm',
  };

  async run(params: UniversalQueryParams, ctx: ToolContext) {
    const qb = ctx.dataSource
      .createQueryBuilder(EventOccurrenceEntity, 'occ')
      .innerJoin('occ.series', 'series')
      .where('series.userId = :userId', { userId: ctx.userId });

    return buildStandardQuery(qb, params, FIELD_MAP).getRawMany();
  }
}

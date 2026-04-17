import { EventOccurrenceEntity } from 'src/timeline/entities/event-occurrence.entity';
import { AiTool, buildStandardQuery, ToolContext, UniversalQueryParams } from './base.tool';
import { z } from 'zod';

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

  readonly description = `Timeline event occurrences (habits, meetings, reminders).
CRITICAL DATE RULE: The 'date' field contains full timestamps in the database. 
If the user asks for a specific single day (e.g., "dzisiaj", "wczoraj"), NEVER use the 'eq' operator. 
ALWAYS use the 'between' operator spanning from 00:00:00 to 23:59:59 of that day.
COMPLETION RULE: NEVER filter by "isCompleted" by default. Show both completed and pending items unless the user explicitly asks for only pending or only done items.`;

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

  get zodSchema() {
    return z.object({
      where: z
        .object({
          date: z
            .object({
              between: z.array(z.string()).nullish(),
              eq: z.string().nullish(),
              gt: z.string().nullish(),
              gte: z.string().nullish(),
              lt: z.string().nullish(),
              lte: z.string().nullish(),
            })
            .nullish(),
          isCompleted: z
            .object({
              eq: z.boolean().nullish(),
            })
            .nullish(),
          isSkipped: z
            .object({
              eq: z.boolean().nullish(),
            })
            .nullish(),
          title: z
            .object({
              like: z.string().nullish(),
            })
            .nullish(),
          tags: z
            .object({
              like: z.string().nullish(),
              in: z.array(z.string()).nullish(),
            })
            .nullish(),
          priority: z
            .object({
              eq: z.number().nullish(),
              gte: z.number().nullish(),
              lte: z.number().nullish(),
            })
            .nullish(),
        })
        .nullish(),
      orderBy: z
        .object({
          field: z.enum(['date', 'priority', 'title']),
          direction: z.enum(['asc', 'desc']),
        })
        .nullish(),
      limit: z.number().max(100).nullish(),
    });
  }

  async run(params: UniversalQueryParams, ctx: ToolContext) {
    const qb = ctx.dataSource
      .createQueryBuilder(EventOccurrenceEntity, 'occ')
      .innerJoin('occ.series', 'series')
      .where('series.userId = :userId', { userId: ctx.userId });

    return buildStandardQuery(qb, params, FIELD_MAP).getRawMany();
  }
}

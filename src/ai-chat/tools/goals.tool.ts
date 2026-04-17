import { GoalEntry } from 'src/goals/goals.entity';
import { AiTool, buildStandardQuery, ToolContext, UniversalQueryParams } from './base.tool';
import { z } from 'zod';

const FIELD_MAP: Record<string, string> = {
  id: 'entry.id',
  value: 'entry.value',
  date: 'entry.date',
  categoryId: 'entry.categoryId',
  categoryName: 'cat.name',
  categoryUnit: 'cat.unit',
  categoryTarget: 'cat.target',
  categoryMin: 'cat.min',
  categoryMax: 'cat.max',
  categoryIcon: 'cat.icon',
};

export class GoalsTool extends AiTool {
  readonly name = 'goals';

  readonly description = `Goal tracking entries with category context (e.g., Steps, Water, Sleep).
CRITICAL DATE RULE: The 'date' field contains full timestamps in the database. 
If the user asks for a specific single day (e.g., "dzisiaj", "wczoraj"), NEVER use the 'eq' operator. 
ALWAYS use the 'between' operator spanning from 00:00:00 to 23:59:59 of that day.`;

  get zodSchema(): z.ZodObject<any, any> {
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
          categoryName: z
            .object({
              like: z.string().nullish(),
              eq: z.string().nullish(),
              in: z.array(z.string()).nullish(),
            })
            .nullish(),
          value: z
            .object({
              gt: z.number().nullish(),
              gte: z.number().nullish(),
              lt: z.number().nullish(),
              lte: z.number().nullish(),
            })
            .nullish(),
        })
        .nullish(),
      orderBy: z
        .object({
          field: z.enum(['date', 'value', 'categoryName']),
          direction: z.enum(['asc', 'desc']),
        })
        .nullish(),
      limit: z.number().max(100).nullish(),
    });
  }

  async run(params: UniversalQueryParams, ctx: ToolContext) {
    const qb = ctx.dataSource
      .createQueryBuilder(GoalEntry, 'entry')
      .innerJoin('entry.category', 'cat')
      .innerJoin('cat.userGoal', 'ug')
      .where('ug.userId = :userId', { userId: ctx.userId });

    return buildStandardQuery(qb, params, FIELD_MAP).getRawMany();
  }
}

import { GoalEntry } from 'src/goals/goals.entity';
import { AiTool, buildStandardQuery, ToolContext, UniversalQueryParams } from './base.tool';

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
  readonly description = 'Goal tracking entries with category context';
  readonly fields = {
    id: 'UUID',
    value: 'number (logged value)',
    date: 'timestamp',
    categoryName: 'string (goal name e.g. "Steps", "Water")',
    categoryUnit: 'string (e.g. "km", "glasses")',
    categoryTarget: 'number (daily target)',
    categoryMin: 'number',
    categoryMax: 'number',
    categoryIcon: 'string',
  };

  async run(params: UniversalQueryParams, ctx: ToolContext) {
    const qb = ctx.dataSource
      .createQueryBuilder(GoalEntry, 'entry')
      .innerJoin('entry.category', 'cat')
      .innerJoin('cat.userGoal', 'ug')
      .where('ug.userId = :userId', { userId: ctx.userId });

    return buildStandardQuery(qb, params, FIELD_MAP).getRawMany();
  }
}

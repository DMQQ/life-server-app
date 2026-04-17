import { FlashCard } from 'src/flashcards/flashcards.entity';
import { AiTool, buildStandardQuery, ToolContext, UniversalQueryParams } from './base.tool';
import { z } from 'zod';

const FIELD_MAP: Record<string, string> = {
  id: 'f.id',
  question: 'f.question',
  answer: 'f.answer',
  explanation: 'f.explanation',
  successRate: 'f.success_rate',
  timesReviewed: 'f.times_reviewed',
  correctAnswers: 'f.correct_answers',
  incorrectAnswers: 'f.incorrect_answers',
  difficultyLevel: 'f.difficulty_level',
  lastReviewedAt: 'f.last_reviewed_at',
  groupId: 'f.group_id',
  groupName: 'g.name',
};

export class FlashcardsTool extends AiTool {
  readonly name = 'flashcards';

  readonly description = `Study flashcards with performance stats.
CRITICAL DATE RULE: The 'lastReviewedAt' field contains full timestamps in the database. 
If the user asks for a specific single day, NEVER use the 'eq' operator. 
ALWAYS use the 'between' operator spanning from 00:00:00 to 23:59:59 of that day.`;

  get zodSchema(): z.ZodObject<any, any> {
    return z.object({
      where: z
        .object({
          lastReviewedAt: z
            .object({
              between: z.array(z.string()).nullish(),
              eq: z.string().nullish(),
              gt: z.string().nullish(),
              gte: z.string().nullish(),
              lt: z.string().nullish(),
              lte: z.string().nullish(),
            })
            .nullish(),
          groupName: z
            .object({
              like: z.string().nullish(),
              eq: z.string().nullish(),
            })
            .nullish(),
          difficultyLevel: z
            .object({
              eq: z.number().nullish(),
              gt: z.number().nullish(),
              lt: z.number().nullish(),
            })
            .nullish(),
          successRate: z
            .object({
              gt: z.number().nullish(),
              lt: z.number().nullish(),
            })
            .nullish(),
          timesReviewed: z
            .object({
              gt: z.number().nullish(),
              lt: z.number().nullish(),
            })
            .nullish(),
        })
        .nullish(),
      orderBy: z
        .object({
          field: z.enum(['lastReviewedAt', 'successRate', 'difficultyLevel', 'timesReviewed']),
          direction: z.enum(['asc', 'desc']),
        })
        .nullish(),
      limit: z.number().max(100).nullish(),
    });
  }

  async run(params: UniversalQueryParams, ctx: ToolContext) {
    const qb = ctx.dataSource
      .createQueryBuilder(FlashCard, 'f')
      .innerJoin('f.group', 'g')
      .where('f.user_id = :userId', { userId: ctx.userId });

    return buildStandardQuery(qb, params, FIELD_MAP).getRawMany();
  }
}

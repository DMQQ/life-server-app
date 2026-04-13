import { FlashCard } from 'src/flashcards/flashcards.entity';
import { AiTool, buildStandardQuery, ToolContext, UniversalQueryParams } from './base.tool';

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
  readonly description = 'Study flashcards with performance stats';
  readonly fields = {
    id: 'UUID',
    question: 'string',
    answer: 'string',
    successRate: 'float 0-1',
    timesReviewed: 'number',
    correctAnswers: 'number',
    incorrectAnswers: 'number',
    difficultyLevel: 'number 1-5',
    lastReviewedAt: 'timestamp',
    groupName: 'string (deck name)',
  };

  async run(params: UniversalQueryParams, ctx: ToolContext) {
    const qb = ctx.dataSource
      .createQueryBuilder(FlashCard, 'f')
      .innerJoin('f.group', 'g')
      .where('f.user_id = :userId', { userId: ctx.userId });

    return buildStandardQuery(qb, params, FIELD_MAP).getRawMany();
  }
}

import * as dayjs from 'dayjs';
import { AiTool, ToolContext } from './base.tool';
import { ExtractTasksQuery } from 'src/utils/shared/AI/ExtractTasksQuery';
import { EventOccurrenceEntity } from 'src/timeline/entities/event-occurrence.entity';
import { OccurrenceTodoEntity } from 'src/timeline/entities/occurrence-todo.entity';
import { z } from 'zod';

export class TimelineWidgetTool extends AiTool {
  readonly name = 'timelineWidget';
  readonly description =
    'Extract and preview timeline events/tasks from user text — use when user describes schedule, plans, or wants to create events';

  get zodSchema() {
    return z.object({
      content: z.string().describe('text to extract events from'),
      currentDate: z
        .string()
        .nullish()
        .describe('YYYY-MM-DD — reference date for relative expressions like "tomorrow"'),
    });
  }

  async run(params: { content: string; currentDate?: string }, ctx: ToolContext) {
    const result = await ctx.openAIService.execute(new ExtractTasksQuery(), {
      content: params.content,
      currentDate: params.currentDate ?? (dayjs as any)().format('YYYY-MM-DD'),
      history: [],
    });

    const tasks: EventOccurrenceEntity[] = (result.tasks || []).map((t: any) => {
      const occ = new EventOccurrenceEntity();
      occ.titleOverride = t.titleOverride ?? null;
      occ.descriptionOverride = t.descriptionOverride ?? null;
      occ.date = t.date ?? null;
      occ.beginTimeOverride = t.beginTimeOverride ?? null;
      occ.endTimeOverride = t.endTimeOverride ?? null;
      occ.isCompleted = false;
      occ.isSkipped = false;
      occ.position = 0;
      occ.isRepeat = t.isRepeat ?? false;
      occ.repeatFrequency = t.repeatFrequency ?? null;
      occ.repeatEveryNth = t.repeatEveryNth ?? null;
      occ.repeatCount = t.repeatCount ?? null;
      occ.todos = (t.todos || []).map((title: string) => {
        const todo = new OccurrenceTodoEntity();
        todo.title = title;
        todo.isCompleted = false;
        return todo;
      });
      return occ;
    });

    return { message: result.message, tasks };
  }
}

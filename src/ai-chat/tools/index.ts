import { ExpensesTool } from './expenses.tool';
import { SubscriptionsTool } from './subscriptions.tool';
import { EventsTool } from './events.tool';
import { GoalsTool } from './goals.tool';
import { FlashcardsTool } from './flashcards.tool';
import { LegendTool, DayOfWeekTool, DailySpendingsTool, DailyBreakdownTool } from './wallet-stats.tool';
import { AiTool } from './base.tool';

export const ALL_TOOLS: AiTool[] = [
  new ExpensesTool(),
  new SubscriptionsTool(),
  new EventsTool(),
  new GoalsTool(),
  new FlashcardsTool(),
  new LegendTool(),
  new DayOfWeekTool(),
  new DailySpendingsTool(),
  new DailyBreakdownTool(),
];

export * from './base.tool';
export * from './expenses.tool';
export * from './subscriptions.tool';
export * from './events.tool';
export * from './goals.tool';
export * from './flashcards.tool';
export * from './wallet-stats.tool';

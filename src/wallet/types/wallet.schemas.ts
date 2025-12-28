import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ExpenseType } from '../entities/wallet.entity';

@InputType()
export class RangeDate {
  @Field(() => String, { nullable: true })
  from: number;

  @Field(() => String, { nullable: true })
  to: number;
}

@InputType()
export class AmountRange {
  @Field(() => Float, { nullable: true })
  from: number;

  @Field(() => Float, { nullable: true })
  to: number;
}

@InputType()
export class GetWalletFilters {
  @Field({ nullable: true })
  title?: string;

  @Field(() => [String], { nullable: true })
  category?: string[];

  @Field(() => RangeDate, { nullable: true })
  date?: RangeDate;

  @Field(() => AmountRange, { nullable: true })
  amount?: RangeDate;

  @Field(() => String, { nullable: true })
  type: 'income' | 'expense';

  @Field(() => Boolean, { nullable: true })
  isExactCategory?: boolean;
}

@ObjectType()
export class WalletStatisticsRange {
  @Field(() => Float, { nullable: true })
  total: number;

  @Field(() => Float, { nullable: true })
  average: number;

  @Field(() => Float, { nullable: true })
  max: number;

  @Field(() => Float, { nullable: true })
  min: number;

  @Field(() => Float, { nullable: true })
  count: number;

  @Field(() => String, { nullable: true })
  theMostCommonCategory: string;

  @Field(() => String, { nullable: true })
  theLeastCommonCategory: string;

  @Field(() => Float, { nullable: true })
  lastBalance: number;

  @Field(() => Float, { nullable: true })
  income: number;

  @Field(() => Float, { nullable: true })
  expense: number;
}

@ObjectType()
export class StatisticsLegend {
  @Field(() => String)
  category: string;

  @Field(() => String)
  count: string;

  @Field(() => Float)
  total: number;

  @Field(() => Float)
  percentage: number;
}

@ObjectType()
export class StatisticsDayOfWeekComparison {
  @Field(() => Float)
  day: number;

  @Field(() => Float)
  total: number;

  @Field(() => Float)
  avg: number;

  @Field(() => Float)
  median: number;

  @Field(() => Float)
  count: number;
}

@ObjectType()
export class StatisticsDailySpendings {
  @Field(() => Float)
  total: number;

  @Field(() => String)
  date: string;

  @Field(() => String)
  day: string;
}

@ObjectType()
export class ExpensePredictionType {
  @Field()
  description: string;

  @Field(() => Float)
  amount: number;

  @Field()
  category: string;

  @Field()
  type: ExpenseType;

  @Field({ nullable: true })
  shop?: string;

  @Field({ nullable: true })
  locationId?: string;

  @Field(() => Float)
  confidence: number;
}

@ObjectType()
export class ZeroExpenseStreak {
  @Field(() => String)
  start: string;

  @Field(() => String)
  end: string;

  @Field(() => Int)
  length: number;
}

@ObjectType()
export class ZeroExpenseDays {
  @Field(() => [String])
  days: string[];

  @Field(() => Float)
  avg: number;

  @Field(() => [ZeroExpenseStreak])
  streak: ZeroExpenseStreak[];

  @Field(() => Float)
  saved: number;
}

@ObjectType()
export class CategoryLimitResult {
  @Field(() => String)
  category: string;

  @Field(() => Float)
  spent: number;

  @Field(() => Float)
  limit: number;

  @Field(() => Boolean)
  exceeded: boolean;
}

@ObjectType()
export class MonthlyLimitResult {
  @Field(() => String)
  month: string;

  @Field(() => Float)
  totalSpent: number;

  @Field(() => Float)
  generalLimit: number;

  @Field(() => Boolean)
  generalLimitExceeded: boolean;

  @Field(() => [CategoryLimitResult])
  categories: CategoryLimitResult[];
}

@ObjectType()
export class BalanceProjection {
  @Field(() => Int)
  month: number;

  @Field(() => Int)
  year: number;

  @Field(() => Int)
  monthsAhead: number;

  @Field(() => Float)
  projectedBalance: number;

  @Field(() => Float)
  avgMonthlyIncome: number;

  @Field(() => Float)
  avgMonthlyExpense: number;

  @Field(() => Float)
  avgMonthlyNet: number;
}

@ObjectType()
export class WalletBalancePrediction {
  @Field(() => Float)
  currentBalance: number;

  @Field(() => Float)
  avgMonthlyIncome: number;

  @Field(() => Float)
  avgMonthlyExpense: number;

  @Field(() => Float)
  avgMonthlyNet: number;

  @Field(() => Int)
  historicalMonths: number;

  @Field(() => [BalanceProjection])
  projections: BalanceProjection[];
}

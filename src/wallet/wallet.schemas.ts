import { Field, Float, InputType, ObjectType } from '@nestjs/graphql';

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
}

@ObjectType()
class WalletStatisticsRange {
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

  @Field(() => String)
  theMostCommonCategory: string;

  @Field(() => String)
  theLeastCommonCategory: string;

  @Field(() => Float)
  lastBalance: number;

  @Field(() => Float)
  income: number;

  @Field(() => Float)
  expense: number;
}

@ObjectType()
export class WalletStatistics {
  @Field(() => Float)
  balance: number;

  @Field(() => WalletStatisticsRange)
  month: WalletStatisticsRange;

  @Field(() => WalletStatisticsRange)
  today: WalletStatisticsRange;

  @Field(() => WalletStatisticsRange)
  week: WalletStatisticsRange;
}

import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';

@InputType()
export class CreateLocationDto {
  @Field(() => Float)
  longitude: number;

  @Field(() => Float)
  latitude: number;

  @Field()
  name: string;

  @Field()
  kind: string;
}

@InputType()
export class CreateSubExpenseDto {
  @Field()
  description: string;

  @Field(() => Float)
  amount: number;

  @Field()
  category: string;
}

@InputType()
export class UpdateSubExpenseDto {
  @Field({ nullable: true })
  description?: string;

  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field({ nullable: true })
  category?: string;
}

@ObjectType()
export class MonthlyCategoryComparisonItem {
  @Field(() => String)
  category: string;

  @Field(() => Float)
  total: number;

  @Field(() => Float)
  avg: number;

  @Field(() => Float)
  count: number;
}

@ObjectType()
export class MonthlyCategoryComparisonOutput {
  @Field({ nullable: true })
  month: string;

  @Field(() => [MonthlyCategoryComparisonItem], { nullable: true })
  categories: MonthlyCategoryComparisonItem[];
}

@ObjectType()
export class MonthlyHeatMap {
  @Field(() => Int)
  dayOfMonth: number;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => Float)
  averageAmount: number;
}

@ObjectType()
export class HourlyStats {
  @Field(() => Number)
  hour: number;

  @Field(() => Number)
  count: number;

  @Field(() => Float)
  avg_amount: number;

  @Field(() => Float)
  min_amount: number;

  @Field(() => Float)
  max_amount: number;

  @Field(() => Float)
  std_deviation: number;

  @Field(() => Float)
  variance: number;
}

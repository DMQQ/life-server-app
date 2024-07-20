import { Field, Float, InputType } from '@nestjs/graphql';

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
}

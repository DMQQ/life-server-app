import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';

@InputType()
export class CreateCorrectionMapDto {
  @Field(() => String, { nullable: true })
  matchShop?: string;

  @Field(() => String, { nullable: true })
  matchDescription?: string;

  @Field(() => String, { nullable: true })
  matchCategory?: string;

  @Field(() => Float, { nullable: true })
  matchAmountMin?: number;

  @Field(() => Float, { nullable: true })
  matchAmountMax?: number;

  @Field(() => String, { nullable: true })
  overrideShop?: string;

  @Field(() => String, { nullable: true })
  overrideCategory?: string;

  @Field(() => String, { nullable: true })
  overrideDescription?: string;
}

@InputType()
export class UpdateCorrectionMapDto {
  @Field(() => String, { nullable: true })
  matchShop?: string;

  @Field(() => String, { nullable: true })
  matchDescription?: string;

  @Field(() => String, { nullable: true })
  matchCategory?: string;

  @Field(() => Float, { nullable: true })
  matchAmountMin?: number;

  @Field(() => Float, { nullable: true })
  matchAmountMax?: number;

  @Field(() => String, { nullable: true })
  overrideShop?: string;

  @Field(() => String, { nullable: true })
  overrideCategory?: string;

  @Field(() => String, { nullable: true })
  overrideDescription?: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}

@ObjectType()
export class CorrectionPreviewType {
  @Field(() => String, { nullable: true })
  shop: string;

  @Field(() => String, { nullable: true })
  category: string;

  @Field(() => String, { nullable: true })
  description: string;

  @Field(() => Boolean)
  corrected: boolean;

  @Field(() => ID, { nullable: true })
  appliedRuleId: string;
}

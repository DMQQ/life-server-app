import { InputType, Field, ID, Float } from '@nestjs/graphql';
import { BillingCycleEnum } from '../entities/subscription.entity';

@InputType()
export class CreateSubscriptionInput {
  @Field(() => Float)
  amount: number;

  @Field(() => String)
  dateStart: Date;

  @Field(() => String, { nullable: true })
  dateEnd?: Date;

  @Field(() => String)
  description: string;

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => String)
  nextBillingDate: Date;

  @Field(() => String)
  billingCycle: BillingCycleEnum;

  @Field(() => ID)
  walletId: string;
}

@InputType()
export class UpdateSubscriptionInput {
  @Field(() => ID)
  id: string;

  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field(() => String, { nullable: true })
  dateStart?: Date;

  @Field(() => String, { nullable: true })
  dateEnd?: Date;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => String, { nullable: true })
  nextBillingDate?: Date;

  @Field(() => String, { nullable: true })
  billingCycle?: BillingCycleEnum;

  @Field(() => ID, { nullable: true })
  walletId?: string;
}

import { Field, Float, InputType, ObjectType } from '@nestjs/graphql';
import { WalletLimits } from '../entities/wallet.entity';

@ObjectType()
export class LimitsOutput extends WalletLimits {
  @Field(() => Float)
  current: number;
}

@InputType()
export class CreateLimit {
  @Field()
  category: string;

  @Field(() => Float)
  amount: number;

  @Field(() => String)
  type: string;
}

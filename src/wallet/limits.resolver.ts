import {
  Args,
  Field,
  Float,
  ObjectType,
  Resolver,
  Query,
  Mutation,
  InputType,
  ID,
} from '@nestjs/graphql';
import { LimitRange, WalletLimits } from './wallet.entity';
import { LimitsService } from './limits.service';
import { User } from 'src/utils/decorators/User';
import { WalletService } from './wallet.service';

@ObjectType()
export class LimitsOutput extends WalletLimits {
  @Field(() => Float)
  current: number;
}

@InputType()
class CreateLimit {
  @Field()
  category: string;

  @Field(() => Float)
  amount: number;

  @Field(() => String)
  type: string;
}

@Resolver()
export class LimitsResolver {
  constructor(
    private limitService: LimitsService,
    private walletService: WalletService,
  ) {}

  @Query(() => [LimitsOutput])
  async limits(
    @Args('range', { type: () => String }) range: LimitRange,
    @User() user: string,
  ) {
    return this.limitService.limits(
      (await this.walletService.findWalletId(user)).id,
      range,
    );
  }

  @Mutation(() => Boolean)
  async deleteLimit(
    @Args('id', { type: () => ID, nullable: false }) id: string,
  ) {
    return !!(await this.limitService.delete(id));
  }

  @Mutation(() => WalletLimits)
  async createLimit(
    @Args('input', { type: () => CreateLimit, nullable: false })
    input: CreateLimit,

    @User() user: string,
  ) {
    const walletId = (await this.walletService.findWalletId(user)).id;
    return this.limitService.create({
      ...input,
      walletId,
      type: input.type as LimitRange,
    });
  }
}

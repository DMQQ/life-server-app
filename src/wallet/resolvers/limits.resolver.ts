import { Args, Resolver, Query, Mutation, ID } from '@nestjs/graphql';
import { LimitRange, WalletLimits } from '../entities/wallet.entity';
import { LimitsService } from '../services/limits.service';
import {
  CacheInterceptor,
  DefaultCacheModule,
  InvalidateCache,
  InvalidateCacheInterceptor,
  UserCache,
} from '../../utils/services/Cache/cache.decorator';
import { UseInterceptors } from '@nestjs/common';
import { WalletId } from 'src/utils/decorators/wallet.decorator';
import { CreateLimit, LimitsOutput } from '../types/limit.schemas';
import dayjs from 'dayjs';

@UseInterceptors(CacheInterceptor, InvalidateCacheInterceptor)
@DefaultCacheModule('Wallet', { invalidateCurrentUser: true })
@Resolver()
export class LimitsResolver {
  constructor(private limitService: LimitsService) {}

  @Query(() => [LimitsOutput])
  @UserCache(3600)
  async limits(
    @Args('range', { type: () => String }) range: LimitRange,
    @WalletId() walletId: string,
    @Args('date', { nullable: false }) date: string,
  ) {
    return this.limitService.limits(walletId, range, date || dayjs().format('YYYY-MM-DD'));
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  async deleteLimit(@Args('id', { type: () => ID, nullable: false }) id: string) {
    return !!(await this.limitService.delete(id));
  }

  @Mutation(() => WalletLimits)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createLimit(
    @Args('input', { type: () => CreateLimit, nullable: false })
    input: CreateLimit,

    @WalletId() walletId: string,
  ) {
    return this.limitService.create({
      ...input,
      walletId,
      type: input.type as LimitRange,
    });
  }
}

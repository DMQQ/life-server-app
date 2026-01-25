import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { SubscriptionEntity } from '../entities/subscription.entity';
import {
  CacheInterceptor,
  DefaultCacheModule,
  InvalidateCache,
  InvalidateCacheInterceptor,
  UserCache,
} from 'src/utils/services/Cache/cache.decorator';
import { User } from 'src/utils/decorators/user.decorator';
import { SubscriptionService } from '../services/subscriptions.service';
import { BadRequestException, UseInterceptors } from '@nestjs/common';
import { ExpenseEntity } from '../entities/wallet.entity';
import { WalletId } from 'src/utils/decorators/wallet.decorator';
import { WalletService } from '../services/wallet.service';
import { UpdateSubscriptionInput } from '../types/subscription.schemas';

@UseInterceptors(CacheInterceptor, InvalidateCacheInterceptor)
@DefaultCacheModule('Wallet', { invalidateCurrentUser: true })
@Resolver(() => SubscriptionEntity)
export class SubscriptionResolver {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly walletService: WalletService,
  ) {}

  @ResolveField('subscription', () => SubscriptionEntity, { nullable: true })
  async getSubscription(@Parent() { subscriptionId }: ExpenseEntity) {
    if (!subscriptionId) return null;

    try {
      const subscription = await this.subscriptionService.getSubscriptionById(subscriptionId);

      return subscription;
    } catch (error) {
      return null;
    }
  }

  @Query(() => SubscriptionEntity)
  async getPossibleSubscription(
    @Args('expenseId', { type: () => ID, nullable: false }) expenseId: string,
    @WalletId() walletId: string,
  ) {
    return this.subscriptionService.getPossibleSubscription(expenseId, walletId);
  }

  @Query(() => [SubscriptionEntity])
  @UserCache(3600)
  subscriptions(@User() userId: string) {
    return this.subscriptionService.getSubscriptions(userId);
  }

  @Mutation(() => SubscriptionEntity)
  async modifySubscription(@Args('input') input: UpdateSubscriptionInput) {
    return this.subscriptionService.modifySubscription(input);
  }

  @Query(() => SubscriptionEntity)
  @UserCache(3600)
  subscription(@Args('id') id: string) {
    return this.subscriptionService.getSubscriptionById(id);
  }

  @Mutation(() => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async createSubscription(
    @WalletId() walletId: string,
    @Args('expenseId', { type: () => ID, nullable: false }) expenseId: string,
  ) {
    try {
      await this.subscriptionService.createSubscription(expenseId, walletId);

      return this.walletService.getExpense(expenseId);
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Subscription creation failed');
    }
  }

  @Mutation(() => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async cancelSubscription(@Args('subscriptionId', { type: () => ID }) subscriptionId: string) {
    try {
      await this.subscriptionService.cancelSubscription(subscriptionId);

      return this.subscriptionService.getExpenseBySubscriptionId(subscriptionId);
    } catch (error) {
      throw new BadRequestException('Subscription cancelation failed');
    }
  }

  @Mutation(() => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async renewSubscription(@Args('subscriptionId', { type: () => ID }) subscriptionId: string) {
    try {
      const result = await this.subscriptionService.renewSubscription(subscriptionId, this.walletService);

      return result.expense;
    } catch (error) {
      console.error('Subscription renewal error:', error);
      throw new BadRequestException('Subscription renewal failed');
    }
  }

  @Mutation(() => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  async assignExpenseToSubscription(
    @Args('expenseId', { type: () => ID }) expenseId: string,
    @Args('subscriptionId', { type: () => ID, nullable: true }) subscriptionId: string | null,
  ) {
    try {
      await this.subscriptionService.assignSubscription(expenseId, subscriptionId);
      return this.walletService.getExpense(expenseId);
    } catch (error) {
      console.error('Assign expense to subscription error:', error);
      throw new BadRequestException('Failed to assign expense to subscription');
    }
  }
}

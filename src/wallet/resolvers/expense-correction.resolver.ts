import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import { User } from 'src/utils/decorators/user.decorator';
import { ExpenseCorrectionMapEntity } from '../entities/expense-correction-map.entity';
import { ExpenseCorrectionService } from '../services/expense-correction.service';
import { CreateCorrectionMapDto, CorrectionPreviewType, UpdateCorrectionMapDto } from '../types/expense-correction.schemas';
import {
  CacheInterceptor,
  DefaultCacheModule,
  InvalidateCache,
  InvalidateCacheInterceptor,
  UserCache,
} from '../../utils/services/Cache/cache.decorator';

@UseInterceptors(CacheInterceptor, InvalidateCacheInterceptor)
@DefaultCacheModule('Wallet', { invalidateCurrentUser: true })
@UseGuards(AuthGuard)
@Resolver(() => ExpenseCorrectionMapEntity)
export class ExpenseCorrectionResolver {
  constructor(private readonly correctionService: ExpenseCorrectionService) {}

  @Query(() => [ExpenseCorrectionMapEntity])
  @UserCache(3600)
  correctionMaps(@User() userId: string): Promise<ExpenseCorrectionMapEntity[]> {
    return this.correctionService.findAll(userId);
  }

  @Query(() => ExpenseCorrectionMapEntity, { nullable: true })
  @UserCache(3600)
  correctionMap(@Args('id', { type: () => ID }) id: string): Promise<ExpenseCorrectionMapEntity | null> {
    return this.correctionService.findOne(id);
  }

  @Mutation(() => ExpenseCorrectionMapEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  createCorrectionMap(
    @User() userId: string,
    @Args('input', { type: () => CreateCorrectionMapDto }) input: CreateCorrectionMapDto,
  ): Promise<ExpenseCorrectionMapEntity> {
    return this.correctionService.create(userId, input);
  }

  @Mutation(() => ExpenseCorrectionMapEntity)
  @InvalidateCache({ invalidateCurrentUser: true })
  updateCorrectionMap(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateCorrectionMapDto }) input: UpdateCorrectionMapDto,
  ): Promise<ExpenseCorrectionMapEntity> {
    return this.correctionService.update(id, input);
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser: true })
  deleteCorrectionMap(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.correctionService.delete(id);
  }

  @Query(() => CorrectionPreviewType)
  async previewCorrection(
    @User() userId: string,
    @Args('description') description: string,
    @Args('shop', { nullable: true }) shop?: string,
    @Args('category', { nullable: true }) category?: string,
    @Args('amount', { nullable: true }) amount?: number,
  ): Promise<CorrectionPreviewType> {
    const result = await this.correctionService.applyCorrections(userId, { description, shop, category, amount });
    return {
      shop: result.shop ?? null,
      category: result.category ?? null,
      description: result.description,
      corrected: result.corrected,
      appliedRuleId: result.appliedRuleId ?? null,
    };
  }
}

import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { User } from 'src/utils/decorators/user.decorator';
import {
  AiChatResponse,
  AiChatSkill,
  ChatMessageInput,
  MonthlyLimitResult,
  StatisticsDailySpendings,
  StatisticsDayOfWeekComparison,
  StatisticsLegend,
  WalletBalancePrediction,
  ZeroExpenseDays,
} from '../types/wallet.schemas';
import { StatisticsService } from '../services/statistics.service';
import {
  CacheInterceptor,
  DefaultCacheModule,
  InvalidateCacheInterceptor,
  UserCache,
} from '../../utils/services/Cache/cache.decorator';
import { UseInterceptors } from '@nestjs/common';
import { WalletId } from 'src/utils/decorators/wallet.decorator';
import { OpenAIService } from 'src/utils/services/OpenAI/openai.service';
import { StatisticsChatQuery } from 'src/utils/shared/AI/StatisticsChatQuery';
import { WalletService } from '../services/wallet.service';
import { SubscriptionService } from '../services/subscriptions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AiChatHistorySkill,
  StatisticsAiChatHistoryEntity,
} from '../entities/statistics-ai-chat-history.entity';

@UseInterceptors(CacheInterceptor, InvalidateCacheInterceptor)
@DefaultCacheModule('Wallet', { invalidateCurrentUser: true })
@Resolver()
export class StatisticsResolver {
  constructor(
    private statisticsService: StatisticsService,
    private walletService: WalletService,
    private subscriptionService: SubscriptionService,
    private openAIService: OpenAIService,
    @InjectRepository(StatisticsAiChatHistoryEntity)
    private chatHistoryRepository: Repository<StatisticsAiChatHistoryEntity>,
  ) {}

  @Query(() => [StatisticsLegend])
  @UserCache(3600)
  async statisticsLegend(
    @WalletId() walletId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @Args('displayMode') displayMode: 'detailed' | 'general',
  ) {
    return this.statisticsService.legend(walletId, startDate, endDate, displayMode);
  }

  @Query(() => [StatisticsDayOfWeekComparison])
  @UserCache(3600)
  async statisticsDayOfWeek(
    @WalletId() walletId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    return this.statisticsService.dayOfWeek(walletId, startDate, endDate);
  }

  @Query(() => [StatisticsDailySpendings])
  @UserCache(3600)
  async statisticsDailySpendings(
    @WalletId() walletId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    return this.statisticsService.spendingsByDay(walletId, startDate, endDate);
  }

  @Query(() => ZeroExpenseDays)
  @UserCache(7200)
  async statisticsZeroExpenseDays(
    @WalletId() walletId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    const [days, avg, streak] = await Promise.all([
      this.statisticsService.zeroExpensesDays(walletId, startDate, endDate),
      this.statisticsService.avgSpendingsInRange(walletId, startDate, endDate),
      this.statisticsService.noSpendingsStreaks(walletId, startDate, endDate),
    ]);

    const saved = days.length * avg;

    return { days, avg, streak, saved };
  }

  @Query(() => [MonthlyLimitResult])
  @UserCache(7200)
  async statisticsSpendingsLimits(
    @User() userId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    return this.statisticsService.spendingsLimits(userId, startDate, endDate);
  }

  @Query(() => WalletBalancePrediction)
  @UserCache(7200)
  async walletBalancePrediction(@WalletId() walletId: string, @Args('toDate', { type: () => String }) toDate: string) {
    return this.statisticsService.getWalletBalancePrediction(walletId, toDate);
  }

  @Query(() => [StatisticsAiChatHistoryEntity])
  async statisticsAiChatHistory(@User() userId: string): Promise<StatisticsAiChatHistoryEntity[]> {
    return this.chatHistoryRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  @Mutation(() => AiChatResponse)
  async statisticsAiChat(
    @WalletId() walletId: string,
    @User() userId: string,
    @Args('statTypes', { type: () => [String] }) statTypes: string[],
    @Args('message') message: string,
    @Args('startDate', { nullable: true }) startDate: string,
    @Args('endDate', { nullable: true }) endDate: string,
    @Args('history', { type: () => [ChatMessageInput], nullable: true, defaultValue: [] })
    history: ChatMessageInput[],
  ): Promise<AiChatResponse> {
    const fetchers: Record<string, () => Promise<any>> = {
      legend: () => this.statisticsService.legend(walletId, startDate, endDate, 'general'),
      dayOfWeek: () => this.statisticsService.dayOfWeek(walletId, startDate, endDate),
      dailySpendings: () => this.statisticsService.spendingsByDay(walletId, startDate, endDate),
      zeroExpenseDays: async () => {
        const [days, avg, streak] = await Promise.all([
          this.statisticsService.zeroExpensesDays(walletId, startDate, endDate),
          this.statisticsService.avgSpendingsInRange(walletId, startDate, endDate),
          this.statisticsService.noSpendingsStreaks(walletId, startDate, endDate),
        ]);
        return { days, avg, streak, saved: days.length * avg };
      },
      spendingsLimits: () => this.statisticsService.spendingsLimits(userId, startDate, endDate),
      balancePrediction: () => this.statisticsService.getWalletBalancePrediction(walletId, endDate),
      dailyBreakdown: () => this.statisticsService.dailyBreakdownByCategory(walletId, startDate, endDate),
      recentExpenses: () => this.statisticsService.getRecentExpenses(walletId, 50),
      subscriptions: () => this.subscriptionService.getSubscriptions(userId),
    };

    const unknown = statTypes.filter((t) => !fetchers[t]);
    if (unknown.length) throw new Error(`Unknown statTypes: ${unknown.join(', ')}`);

    const results = await Promise.all(statTypes.map((t) => fetchers[t]().then((d) => [t, d] as const)));
    const data = Object.fromEntries(results);

    // Build available skills context so the AI knows what it can reference
    const recentExpenses: { id: string; description: string; amount: number }[] = (data.recentExpenses ?? []).map(
      (e: any) => ({ id: e.id, description: e.description, amount: e.amount }),
    );

    const subscriptionList: { id: string; description: string }[] = (data.subscriptions ?? []).map((s: any) => ({
      id: s.id,
      description: s.description,
    }));

    const aiOutput = await this.openAIService.execute(new StatisticsChatQuery(), {
      statType: statTypes.join(', '),
      data,
      message,
      history: history ?? [],
      availableSkills: {
        chartSubtypes: statTypes.filter((t) => !['recentExpenses', 'subscriptions'].includes(t)),
        expenses: recentExpenses,
        subscriptions: subscriptionList,
      },
    });

    // Resolve each skill reference into its full data
    const validExpenseIds = new Set(recentExpenses.map((e) => e.id));
    const validSubscriptionIds = new Set(subscriptionList.map((s) => s.id));

    const resolvedSkills: AiChatSkill[] = await Promise.all(
      (aiOutput.skills ?? []).map(async (skill): Promise<AiChatSkill | null> => {
        if (skill.type === 'chart') {
          const chartData = data[skill.subtype];
          if (!chartData) return null;
          return { type: 'chart', subtype: skill.subtype, chartData: JSON.stringify(chartData) };
        }

        if (skill.type === 'expense') {
          if (!skill.id || !validExpenseIds.has(skill.id)) return null;
          const expense = await this.walletService.getExpense(skill.id);
          if (!expense) return null;
          return { type: 'expense', expense };
        }

        if (skill.type === 'subscription') {
          if (!skill.id || !validSubscriptionIds.has(skill.id)) return null;
          const subscription = await this.subscriptionService.getSubscriptionById(skill.id);
          if (!subscription) return null;
          return { type: 'subscription', subscription };
        }

        return null;
      }),
    );

    const finalSkills = resolvedSkills.filter(Boolean) as AiChatSkill[];

    const historySkills: AiChatHistorySkill[] = finalSkills.map((s) => ({
      type: s.type,
      subtype: s.subtype,
      chartData: s.chartData,
      expenseId: s.expense?.id,
      subscriptionId: s.subscription?.id,
    }));

    this.chatHistoryRepository.save({
      userId,
      userMessage: message,
      aiMessage: aiOutput.message,
      statTypes,
      skills: historySkills,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    });

    return { message: aiOutput.message, skills: finalSkills };
  }
}

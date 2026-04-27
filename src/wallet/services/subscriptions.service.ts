import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TextSimilarityService } from 'src/utils/services/TextSimilarity/text-similarity.service';
import { LessThan, Repository } from 'typeorm';
import { BillingCycleEnum, SubscriptionEntity } from '../entities/subscription.entity';
import { ExpenseEntity } from '../entities/wallet.entity';
import SubscriptionFactory from '../factories/subscription.factory';
import { SubscriptionBillingUtils } from '../utils/subscription-billing.util';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private subscriptionRepository: Repository<SubscriptionEntity>,

    @InjectRepository(ExpenseEntity)
    private expenseRepository: Repository<ExpenseEntity>,

    private readonly textSimilarityService: TextSimilarityService,
  ) {}

  async insert(subscription: Partial<SubscriptionEntity>) {
    if (subscription.reminderDaysBeforehand == null && subscription.billingCycle) {
      subscription.reminderDaysBeforehand = this.getDefaultReminderDays(subscription.billingCycle);
    }
    subscription.nextBillingDate = SubscriptionEntity.formatDate(subscription.nextBillingDate);
    subscription.dateStart = SubscriptionEntity.formatDate(subscription.dateStart);
    subscription.isActive = true;
    return await this.subscriptionRepository.save(subscription);
  }

  async getSubscriptionById(id: string) {
    return await this.subscriptionRepository.findOne({
      where: { id },
      relations: ['expenses'],
      order: { nextBillingDate: 'desc' },
    });
  }

  async getTodaySubscriptions() {
    return await this.subscriptionRepository.find({
      relations: { expenses: true },
      where: [
        { nextBillingDate: SubscriptionEntity.formatDate(new Date()), isActive: true },
        {
          isActive: true,
          nextBillingDate: LessThan(SubscriptionEntity.formatDate(new Date())),
        },
      ],
    });
  }

  getDefaultReminderDays(cycle: BillingCycleEnum): number {
    const map: Record<BillingCycleEnum, number> = {
      [BillingCycleEnum.DAILY]: 0,
      [BillingCycleEnum.WEEKLY]: 1,
      [BillingCycleEnum.MONTHLY]: 3,
      [BillingCycleEnum.YEARLY]: 30,
      [BillingCycleEnum.CUSTOM]: 7,
    };
    return map[cycle] ?? 3;
  }

  async setNextBillingDate(subscription: SubscriptionEntity) {
    const today = SubscriptionEntity.formatDate(new Date());

    do {
      subscription.nextBillingDate = SubscriptionEntity.formatDate(SubscriptionBillingUtils.getNextBillingDate(subscription));
    } while (subscription.nextBillingDate < today);
    return await this.subscriptionRepository.save(subscription);
  }

  async cancelSubscription(subscriptionId: string) {
    const subscription = await this.getSubscriptionById(subscriptionId);
    subscription.isActive = false;
    return await this.subscriptionRepository.save(subscription);
  }

  async renewSubscription(subscriptionId: string, walletService: any) {
    const subscription = await this.getSubscriptionById(subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const now = new Date();
    subscription.isActive = true;
    subscription.dateStart = now;
    subscription.nextBillingDate = SubscriptionEntity.formatDate(SubscriptionBillingUtils.getNextBillingDate(subscription));

    const updatedSubscription = await this.subscriptionRepository.save(subscription);

    const lastExpense = await walletService.getSubscriptionLastExpense(subscription.id);

    if (!lastExpense) {
      throw new Error('No previous expense found for this subscription');
    }

    delete lastExpense.id;

    const newExpense = await walletService.createSubscriptionExpense(subscription.walletId, {
      ...lastExpense,
      date: now,
      subscriptionId: subscription.id,
      note: 'Subscription renewed',
      subscription: subscription,
    });

    return {
      subscription: updatedSubscription,
      expense: newExpense,
    };
  }

  async enableSubscription(subscriptionId: string) {
    await this.subscriptionRepository.update({ id: subscriptionId }, { isActive: true });
    return this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
      relations: ['expenses'],
    });
  }

  async getExpenseBySubscriptionId(subscriptionId: string) {
    return this.expenseRepository.findOne({
      where: { subscriptionId },
      order: { date: 'DESC' },
      relations: ['subscription'],
    });
  }

  assignSubscription(expenseId: string, subscriptionId: string) {
    return this.expenseRepository.update({ id: expenseId }, { subscriptionId: subscriptionId });
  }

  async getExpense(id: string) {
    return this.expenseRepository.findOneOrFail({
      where: { id },
      relations: ['subscription'],
    });
  }

  async createSubscription(expenseId: string, walletId: string) {
    const expense = await this.getExpense(expenseId);

    let sub = null;

    if (!expense.subscriptionId) {
      sub = await this.insert(
        SubscriptionFactory.create({
          ...expense,
        }),
      );
      await this.assignSubscription(expenseId, sub.id);
    } else {
      await this.enableSubscription(expense.subscriptionId);
    }
  }

  async getActiveSubscriptions(walletId: string): Promise<SubscriptionEntity[]> {
    return this.subscriptionRepository.find({ where: { walletId, isActive: true }, relations: ['expenses'] });
  }

  async getSubscriptionsDueOn(walletId: string, date: string): Promise<SubscriptionEntity[]> {
    try {
      const formattedDate = SubscriptionEntity.formatDate(new Date(date));

      const subscriptions = await this.subscriptionRepository.find({
        where: {
          walletId,
          nextBillingDate: formattedDate,
          isActive: true,
        },
        relations: ['expenses'],
      });

      return subscriptions;
    } catch (error) {
      console.error(`Error getting subscriptions due on ${date}:`, error.message);
      return [];
    }
  }

  async getSubscriptions(userId: string) {
    const [wallet] = await this.expenseRepository.query('SELECT id FROM wallet WHERE userId = ?', [userId]);
    const walletId = wallet?.id;

    return this.subscriptionRepository.find({
      where: { walletId },
      relations: ['expenses'],
      order: { nextBillingDate: 'asc' },
    });
  }

  async modifySubscription({ id, walletId, ...subscription }: Partial<SubscriptionEntity> & { id: string }) {
    await this.subscriptionRepository.update({ id }, subscription);
    const entity = await this.getSubscriptionById(id);
    return entity;
  }

  async getPossibleSubscription(expenseId: string, walletId: string) {
    const expense = await this.expenseRepository.findOne({
      where: { id: expenseId, walletId },
    });

    if (!expense) {
      throw new Error('Expense not found');
    }

    const subscriptions = await this.subscriptionRepository.find({
      where: expense.description.split(' ').map((word) => ({
        description: word,
        walletId: walletId,
      })),
    });

    if (subscriptions.length === 0) {
      return [];
    }

    const result = await this.textSimilarityService.findMostSimilar(
      expense.description,
      subscriptions,
      (item) => item.description,
    );

    return result.map((v) => v.item).slice(0, 3);
  }
}

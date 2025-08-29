import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import { TextSimilarityService } from 'src/utils/services/TextSimilarity/text-similarity.service';
import { Repository } from 'typeorm';
import { BillingCycleEnum, SubscriptionEntity } from '../entities/subscription.entity';
import { ExpenseEntity } from '../entities/wallet.entity';

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
    subscription.nextBillingDate = this.formatDate(subscription.nextBillingDate);
    subscription.dateStart = this.formatDate(subscription.dateStart);
    return await this.subscriptionRepository.save(subscription);
  }

  async getAllSubscriptions() {
    return await this.subscriptionRepository.find();
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
      where: { nextBillingDate: this.formatDate(new Date()) },
    });
  }

  async getLastExpenseOfSubscription(subscription: SubscriptionEntity) {
    return await this.subscriptionRepository
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.expenses', 'expenses')
      .where('subscription.id = :id', { id: subscription.id })
      .orderBy('expenses.date', 'DESC')
      .getOne();
  }

  async getSubscriptionWithBillingDate(date: Date) {
    return await this.subscriptionRepository.find({
      where: { nextBillingDate: date },
    });
  }

  getNextBillingDate(subscription: { billingCycle: BillingCycleEnum; nextBillingDate: Date }) {
    switch (subscription.billingCycle) {
      case BillingCycleEnum.MONTHLY:
        return dayjs(subscription.nextBillingDate).add(1, 'month').toDate();
      case BillingCycleEnum.WEEKLY:
        return dayjs(subscription.nextBillingDate).add(7, 'days').toDate();
      case BillingCycleEnum.DAILY:
        return dayjs(subscription.nextBillingDate).add(1, 'days').toDate();
      default:
        throw new Error('Invalid billing cycle');
    }
  }

  async setNextBillingDate(subscription: SubscriptionEntity) {
    subscription.nextBillingDate = this.formatDate(await this.getNextBillingDate(subscription));
    return await this.subscriptionRepository.save(subscription);
  }

  formatDate(date: Date) {
    const formattedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

    return formattedDate;
  }

  getBillingCycleString(nextBillingDate: string | Date, billingCycle: BillingCycleEnum) {
    switch (billingCycle) {
      case BillingCycleEnum.MONTHLY:
        return `${dayjs(nextBillingDate).subtract(30, 'days').format('MM-DD')}-${dayjs(nextBillingDate).format(
          'MM-DD',
        )}`;
      case BillingCycleEnum.WEEKLY:
        return `${dayjs(nextBillingDate).subtract(7, 'days').format('MM-DD')}-${dayjs(nextBillingDate).format(
          'MM-DD',
        )}`;
      case BillingCycleEnum.DAILY:
        return `${dayjs(nextBillingDate).subtract(1, 'days').format('MM-DD')}-${dayjs(nextBillingDate).format(
          'MM-DD',
        )}`;
      case BillingCycleEnum.YEARLY:
        return `${dayjs(nextBillingDate).subtract(365, 'days').format('YYYY-MM')}-${dayjs(nextBillingDate).format(
          'YYYY-MM',
        )}`;
      default:
        throw new Error('Invalid billing cycle');
    }
  }

  async cancelSubscription(subscriptionId: string) {
    const subscription = await this.getSubscriptionById(subscriptionId);
    subscription.isActive = false;
    return await this.subscriptionRepository.save(subscription);
  }

  async enableSubscription(subscriptionId: string) {
    await this.subscriptionRepository.update({ id: subscriptionId }, { isActive: true });
    return this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
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

  hasSubscription(expenseId: string) {
    return this.expenseRepository
      .createQueryBuilder('e')
      .where('e.id = :id', { id: expenseId })
      .andWhere('e.subscriptionId IS NOT NULL')
      .getOne();
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
      sub = await this.insert({
        amount: expense.amount,
        dateStart: expense.date,
        dateEnd: null,
        description: expense.description,
        isActive: true,
        billingCycle: BillingCycleEnum.MONTHLY,
        nextBillingDate: this.getNextBillingDate({
          billingCycle: BillingCycleEnum.MONTHLY,
          nextBillingDate: expense.date,
        }),
        walletId: walletId,
      });
      await this.assignSubscription(expenseId, sub.id);
    } else {
      await this.enableSubscription(expense.subscriptionId);
    }
  }

  async getSubscriptionsDueOn(walletId: string, date: string): Promise<SubscriptionEntity[]> {
    try {
      const formattedDate = this.formatDate(new Date(date));

      const subscriptions = await this.subscriptionRepository.find({
        where: {
          walletId,
          nextBillingDate: formattedDate,
          isActive: true,
        },
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

  async modifySubscription({ id, ...subscription }: Partial<SubscriptionEntity> & { id: string }) {
    return this.subscriptionRepository.update({ id }, subscription);
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

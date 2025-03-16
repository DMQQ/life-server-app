import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingCycleEnum, SubscriptionEntity } from './subscription.entity';
import * as moment from 'moment';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private subscriptionRepository: Repository<SubscriptionEntity>,
  ) {}

  async createSubscription(subscription: Partial<SubscriptionEntity>) {
    subscription.nextBillingDate = this.formatDate(
      subscription.nextBillingDate,
    );
    subscription.dateStart = this.formatDate(subscription.dateStart);
    return await this.subscriptionRepository.save(subscription);
  }

  async getAllSubscriptions() {
    return await this.subscriptionRepository.find();
  }

  async getSubscriptionById(id: string) {
    return await this.subscriptionRepository.findOne({ where: { id } });
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

  getNextBillingDate(subscription: {
    billingCycle: BillingCycleEnum;
    nextBillingDate: Date;
  }) {
    switch (subscription.billingCycle) {
      case BillingCycleEnum.MONTHLY:
        return moment(subscription.nextBillingDate).add(30, 'days').toDate();
      case BillingCycleEnum.WEEKLY:
        return moment(subscription.nextBillingDate).add(7, 'days').toDate();
      case BillingCycleEnum.DAILY:
        return moment(subscription.nextBillingDate).add(1, 'days').toDate();
      default:
        throw new Error('Invalid billing cycle');
    }
  }

  async setNextBillingDate(subscription: SubscriptionEntity) {
    subscription.nextBillingDate = this.formatDate(
      await this.getNextBillingDate(subscription),
    );
    return await this.subscriptionRepository.save(subscription);
  }

  formatDate(date: Date) {
    const formattedDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0,
    );

    return formattedDate;
  }

  getBillingCycleString(
    nextBillingDate: string | Date,
    billingCycle: BillingCycleEnum,
  ) {
    switch (billingCycle) {
      case BillingCycleEnum.MONTHLY:
        return `${moment(nextBillingDate)
          .subtract(30, 'days')
          .format('YYYY-MM-DD')}-${moment(nextBillingDate).format(
          'YYYY-MM-DD',
        )}`;
      case BillingCycleEnum.WEEKLY:
        return `${moment(nextBillingDate)
          .subtract(7, 'days')
          .format('YYYY-MM-DD')}-${moment(nextBillingDate).format(
          'YYYY-MM-DD',
        )}`;
      case BillingCycleEnum.DAILY:
        return `${moment(nextBillingDate)
          .subtract(1, 'days')
          .format('YYYY-MM-DD')}-${moment(nextBillingDate).format(
          'YYYY-MM-DD',
        )}`;
      case BillingCycleEnum.YEARLY:
        return `${moment(nextBillingDate)
          .subtract(365, 'days')
          .format('YYYY-MM-DD')}-${moment(nextBillingDate).format(
          'YYYY-MM-DD',
        )}`;
      default:
        throw new Error('Invalid billing cycle');
    }
  }
}

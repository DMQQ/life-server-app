import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WalletService } from '../wallet.service';
import { SubscriptionService } from '../subscriptions.service';
import dayjs from 'dayjs';
import { BillingCycleEnum, SubscriptionEntity } from '../subscription.entity';

@Injectable()
export class TransactionSchedulerService {
  private readonly logger = new Logger(TransactionSchedulerService.name);

  constructor(private walletService: WalletService, private subscriptionService: SubscriptionService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async addScheduledTransactions() {
    try {
      const transactions = await this.walletService.getScheduledTransactions(new Date());

      this.logger.log(`Adding scheduled transactions: ${transactions.length} for date ${new Date()}`);

      const promises = transactions.map((transaction) => this.walletService.addScheduledTransaction(transaction));

      const results = await Promise.allSettled(promises);

      this.logger.log(
        `Scheduled transactions added: ${results.filter((r) => r.status === 'fulfilled').length} successful, ${
          results.filter((r) => r.status === 'rejected').length
        } failed`,
      );
    } catch (error) {
      this.logger.error(`Error adding scheduled transactions: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async insertSubscriptions() {
    try {
      const subscriptions = await this.subscriptionService.getTodaySubscriptions();
      this.logger.log(`Processing ${subscriptions.length} subscriptions due today`);

      for (const subscription of subscriptions) {
        if (!subscription.isActive) continue;

        try {
          const walletId = subscription.walletId;
          const expense = await this.walletService.getSubscriptionLastExpense(subscription.id);

          if (!expense) {
            this.logger.warn(`No expense found for subscription ${subscription.id}`);
            continue;
          }

          delete expense.id;

          const subscriptionRange = this.subscriptionService.getBillingCycleString(
            subscription.nextBillingDate,
            subscription.billingCycle,
          );

          await this.walletService.createSubscriptionExpense(walletId, {
            ...expense,
            date: new Date(),
            subscriptionId: subscription.id,
            description: this.createDescriptionText(expense.description, subscription),
            note: `Subscription for ${subscriptionRange}`,
            subscription: subscription,
          });

          await this.subscriptionService.setNextBillingDate(subscription);
          this.logger.log(`Processed subscription: ${subscription.id}`);
        } catch (error) {
          this.logger.error(`Error processing subscription ${subscription.id}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error inserting subscriptions: ${error.message}`);
    }
  }

  private createDescriptionText(text: string, subscription: SubscriptionEntity) {
    const cleanText = text
      .replace(/\([A-Za-z]+\)/g, '')
      .replace(/\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}/g, '')
      .replace(/\d{4}-\d{2}-\d{2}/g, '')
      .trim();

    const dateFormat =
      subscription.billingCycle === BillingCycleEnum.MONTHLY
        ? dayjs().format('MMMM')
        : subscription.billingCycle === BillingCycleEnum.DAILY
        ? dayjs().format('MMMM Do')
        : subscription.billingCycle === BillingCycleEnum.WEEKLY
        ? `${dayjs().format('DD')}-${dayjs().add(7, 'day').format('DD')} ${dayjs().add(7, 'day').format('MMMM')}`
        : dayjs().format('YYYY-MM-DD');

    return `${cleanText} (${dateFormat})`.trim();
  }
}

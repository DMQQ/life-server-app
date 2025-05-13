import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ExpenseEntity,
  ExpenseLocationEntity,
  ExpenseSubExpense,
  WalletEntity,
  WalletLimits,
} from 'src/wallet/wallet.entity';
import { WalletResolver } from './wallet.resolver';
import { WalletService } from './wallet.service';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { SubscriptionService } from './subscriptions.service';
import { SubscriptionEntity } from './subscription.entity';
import { ExpenseResolver } from './expense.resolver';
import { ExpenseService } from './expense.service';
import { LimitsService } from './limits.service';
import { LimitsResolver } from './limits.resolver';
import { ReportSchedulerService } from './crons/report-scheduler.service';
import { TransactionSchedulerService } from './crons/transaction-scheduler.service';
import { InsightsSchedulerService } from './crons/insights-scheduler.service';
import { AlertsSchedulerService } from './crons/alerts-scheduler.service';
import { ExpenseAnalysisService } from './crons/expense-analysis.service';
import { MoneyLeftSchedulerService } from './crons/money-left.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WalletEntity,
      ExpenseEntity,
      SubscriptionEntity,
      ExpenseLocationEntity,
      ExpenseSubExpense,
      WalletLimits,
    ]),
    NotificationsModule,
  ],
  providers: [
    WalletResolver,
    WalletService,
    SubscriptionService,
    ExpenseResolver,
    ExpenseService,
    LimitsService,
    LimitsResolver,

    ReportSchedulerService,
    TransactionSchedulerService,
    InsightsSchedulerService,
    AlertsSchedulerService,
    ExpenseAnalysisService,
    MoneyLeftSchedulerService,
  ],
})
export class WalletModule {}

import { Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ExpenseEntity,
  ExpenseLocationEntity,
  ExpenseSubExpense,
  WalletEntity,
  WalletLimits,
  WalletSubAccount,
} from 'src/wallet/entities/wallet.entity';
import { ExpenseCorrectionMapEntity } from 'src/wallet/entities/expense-correction-map.entity';
import { SubscriptionEntity } from './entities/subscription.entity';

import { WalletResolver } from './resolvers/wallet.resolver';
import { ExpenseResolver } from './resolvers/expense.resolver';
import { SubscriptionResolver } from './resolvers/subscription.resolver';
import { LimitsResolver } from './resolvers/limits.resolver';
import { StatisticsResolver } from './resolvers/statistics.resolver';
import { ExpenseCorrectionResolver } from './resolvers/expense-correction.resolver';
import { StatisticsController } from './resolvers/statistics.controller';

import { WalletService } from './services/wallet.service';
import { SubAccountService } from './services/sub-account.service';
import { SubscriptionService } from './services/subscriptions.service';
import { ExpenseService } from './services/expense.service';
import { LimitsService } from './services/limits.service';
import { StatisticsService } from './services/statistics.service';
import { ExpensePredictionService } from './services/expense-prediction.service';
import { ExpenseCorrectionService } from './services/expense-correction.service';

import { ReportSchedulerService } from './crons/report-scheduler.service';
import { TransactionSchedulerService } from './crons/transaction-scheduler.service';
import { InsightsSchedulerService } from './crons/insights-scheduler.service';
import { AlertsSchedulerService } from './crons/alerts-scheduler.service';
import { ExpenseAnalysisService } from './crons/expense-analysis.service';
import { MoneyLeftSchedulerService } from './crons/money-left.service';

import { ExpenseBalanceListener } from './listeners/expense-balance.listener';

import { NotificationsModule } from 'src/notifications/notifications.module';
import { UploadModule } from 'src/upload/upload.module';
import { TextSimilarityModule } from 'src/utils/services/TextSimilarity/text-similarity.module';
import { WalletMiddleware } from 'src/utils/middlewares/wallet.middleware';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WalletEntity,
      ExpenseEntity,
      SubscriptionEntity,
      ExpenseLocationEntity,
      ExpenseSubExpense,
      WalletLimits,
      WalletSubAccount,
      ExpenseCorrectionMapEntity,
    ]),
    NotificationsModule,
    UploadModule,
    TextSimilarityModule,
  ],
  providers: [
    // Resolvers
    WalletResolver,
    SubscriptionResolver,
    ExpenseResolver,
    LimitsResolver,
    StatisticsResolver,
    ExpenseCorrectionResolver,

    // Core services
    WalletService,
    SubAccountService,
    SubscriptionService,
    ExpenseService,
    LimitsService,
    StatisticsService,

    // Auxiliary services
    ExpensePredictionService,
    ExpenseCorrectionService,

    // Schedulers
    ReportSchedulerService,
    TransactionSchedulerService,
    InsightsSchedulerService,
    AlertsSchedulerService,
    ExpenseAnalysisService,
    MoneyLeftSchedulerService,

    // Listeners
    ExpenseBalanceListener,
  ],
  exports: [WalletService, SubAccountService, ExpenseService, SubscriptionService],
  controllers: [StatisticsController],
})
export class WalletModule implements NestModule {
  configure(consumer: any) {
    consumer.apply(WalletMiddleware).forRoutes('*');
  }
}

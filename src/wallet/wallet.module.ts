import { Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ExpenseEntity,
  ExpenseLocationEntity,
  ExpenseSubExpense,
  WalletEntity,
  WalletLimits,
} from 'src/wallet/entities/wallet.entity';
import { WalletResolver } from './resolvers/wallet.resolver';
import { WalletService } from './services/wallet.service';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { SubscriptionService } from './services/subscriptions.service';
import { SubscriptionEntity } from './entities/subscription.entity';
import { ExpenseResolver } from './resolvers/expense.resolver';
import { ExpenseService } from './services/expense.service';
import { LimitsService } from './services/limits.service';
import { LimitsResolver } from './resolvers/limits.resolver';
import { ReportSchedulerService } from './crons/report-scheduler.service';
import { TransactionSchedulerService } from './crons/transaction-scheduler.service';
import { InsightsSchedulerService } from './crons/insights-scheduler.service';
import { AlertsSchedulerService } from './crons/alerts-scheduler.service';
import { ExpenseAnalysisService } from './crons/expense-analysis.service';
import { MoneyLeftSchedulerService } from './crons/money-left.service';
import { StatisticsResolver } from './resolvers/statistics.resolver';
import { StatisticsService } from './services/statistics.service';
import { ExpensePredictionService } from './services/expense-prediction.service';
import { UploadModule } from 'src/upload/upload.module';
import { WalletMiddleware } from 'src/utils/middlewares/wallet.middleware';
import { TextSimilarityModule } from 'src/utils/services/TextSimilarity/text-similarity.module';
import { SubscriptionResolver } from './resolvers/subscription.resolver';

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
    UploadModule,
    TextSimilarityModule,
  ],
  providers: [
    WalletResolver,
    WalletService,
    SubscriptionResolver,
    SubscriptionService,
    ExpenseResolver,
    ExpenseService,
    LimitsService,
    LimitsResolver,

    StatisticsResolver,
    StatisticsService,

    ExpensePredictionService,

    ReportSchedulerService,
    TransactionSchedulerService,
    InsightsSchedulerService,
    AlertsSchedulerService,
    ExpenseAnalysisService,
    MoneyLeftSchedulerService,
  ],
})
export class WalletModule implements NestModule {
  configure(consumer: any) {
    consumer.apply(WalletMiddleware).forRoutes('*');
  }
}

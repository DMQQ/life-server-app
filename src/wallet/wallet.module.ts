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
import { WalletSchedule } from './wallet.schedule';
import { SubscriptionService } from './subscriptions.service';
import { SubscriptionEntity } from './subscription.entity';
import { ExpenseResolver } from './expense.resolver';
import { ExpenseService } from './expense.service';
import { LimitsService } from './limits.service';
import { LimitsResolver } from './limits.resolver';

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
    WalletSchedule,
    SubscriptionService,
    ExpenseResolver,
    ExpenseService,
    LimitsService,
    LimitsResolver,
  ],
})
export class WalletModule {}

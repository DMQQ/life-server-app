import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ExpenseEntity,
  ExpenseLocationEntity,
  WalletEntity,
} from 'src/wallet/wallet.entity';
import { WalletResolver } from './wallet.resolver';
import { WalletService } from './wallet.service';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { WalletSchedule } from './wallet.schedule';
import { SubscriptionService } from './subscriptions.service';
import { SubscriptionEntity } from './subscription.entity';
import { ExpenseResolver } from './expense.resolver';
import { ExpenseService } from './expense.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WalletEntity,
      ExpenseEntity,
      SubscriptionEntity,
      ExpenseLocationEntity,
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
  ],
})
export class WalletModule {}

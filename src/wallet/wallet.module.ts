import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseEntity, WalletEntity } from 'src/wallet/wallet.entity';
import { WalletResolver } from './wallet.resolver';
import { WalletService } from './wallet.service';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { WalletSchedule } from './wallet.schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletEntity, ExpenseEntity]),
    NotificationsModule,
  ],
  providers: [WalletResolver, WalletService, WalletSchedule],
})
export class WalletModule {}

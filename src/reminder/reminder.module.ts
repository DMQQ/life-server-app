import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReminderEntity } from 'src/entities/reminder.entity';
import { ReminderResolver } from './reminder.resolver';
import { ReminderService } from './reminder.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReminderEntity])],
  providers: [ReminderResolver, ReminderService],
})
export class ReminderModule {}

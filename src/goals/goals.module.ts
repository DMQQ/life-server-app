import { Module } from '@nestjs/common';
import { GoalService } from './goals.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoalCategory, GoalEntry, UserGoal } from './goals.entity';
import { GoalResolver } from './goals.resolver';
import { GoalReminderScheduler } from './crons/goal-reminder.scheduler';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserGoal, GoalCategory, GoalEntry]), NotificationsModule],
  providers: [GoalService, GoalResolver, GoalReminderScheduler],
})
export class GoalsModule {}

import { Module } from '@nestjs/common';
import { GoalService } from './goals.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoalCategory, GoalEntry, UserGoal } from './goals.entity';
import { GoalResolver } from './goals.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([UserGoal, GoalCategory, GoalEntry])],
  providers: [GoalService, GoalResolver],
})
export class GoalsModule {}

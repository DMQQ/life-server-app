import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkoutEntity } from 'src/entities/workout.entity';
import { WorkoutService } from './workout.service';
import { WorkoutResolver } from './workout.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([WorkoutEntity])],
  providers: [WorkoutService, WorkoutResolver],
})
export class WorkoutModule {}

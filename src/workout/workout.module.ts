import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  WorkoutEntity,
  ExerciseEntity,
  ExerciseProgressEntity,
  TipsEntity,
} from './workout.entity';
import { WorkoutService } from './workout.service';
import { WorkoutResolver } from './workout.resolver';
import { ExerciseResolver } from './exercise.resolver';
import { ExerciseService } from './exercise.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkoutEntity,
      ExerciseEntity,
      ExerciseProgressEntity,
      TipsEntity,
    ]),
  ],
  providers: [
    WorkoutService,
    WorkoutResolver,
    ExerciseResolver,
    ExerciseService,
  ],
})
export class WorkoutModule {}

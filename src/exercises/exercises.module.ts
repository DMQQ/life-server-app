import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExerciseEntity } from 'src/entities/exercise.entity';
import { ExerciseService } from './exercise.service';
import { ExerciseResolver } from './exercise.resolver';
import { ExerciseProgressEntity } from 'src/entities/exercise_progress.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExerciseEntity, ExerciseProgressEntity])],
  providers: [ExerciseService, ExerciseResolver],
})
export class ExerciseModule {}

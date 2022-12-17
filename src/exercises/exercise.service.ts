import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExerciseEntity } from 'src/entities/exercise.entity';
import { Repository } from 'typeorm';
import { CreateExercise, CreateExerciseProgress } from './exercise.schemas';
import { ExerciseProgressEntity } from 'src/entities/exercise_progress.entity';

@Injectable()
export class ExerciseService {
  constructor(
    @InjectRepository(ExerciseEntity)
    private exerciseRepository: Repository<ExerciseEntity>,

    @InjectRepository(ExerciseProgressEntity)
    private progressRepository: Repository<ExerciseProgressEntity>,
  ) {}

  getExercises() {
    return this.exerciseRepository.find({
      relations: ['exercise_progress'],
    });
  }

  getExerciseProgress(exerciseId: string, userId: string) {
    return this.progressRepository.find({
      where: {
        exerciseId,
        userId,
      },
    });
  }

  getExerciseProgressById(id: string) {
    return this.progressRepository.findOne({
      where: {
        id,
      },
    });
  }

  createProgress(exercise: CreateExerciseProgress & { userId: string }) {
    return this.progressRepository.insert(exercise);
  }

  createExercise(exercise: CreateExercise & { image: string }) {
    return this.exerciseRepository.insert(exercise);
  }
}

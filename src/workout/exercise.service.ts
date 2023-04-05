import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExerciseEntity, WorkoutEntity } from './workout.entity';
import { Repository } from 'typeorm';
import { CreateExercise } from './workout.dto';

@Injectable()
export class ExerciseService {
  constructor(
    @InjectRepository(ExerciseEntity)
    private exerciseEntity: Repository<ExerciseEntity>,
  ) {}

  async createExercise(input: CreateExercise) {
    const exercise = await this.exerciseEntity.insert(input);

    const exerciseId = exercise.generatedMaps[0].exerciseId;

    return await this.exerciseEntity.findOne({
      where: { exerciseId },
      relations: ['tips'],
    });
  }

  async getExercise(exerciseId: string) {
    return await this.exerciseEntity.findOne({
      where: { exerciseId },
      relations: ['tips'],
    });
  }

  async getExercises() {
    return await this.exerciseEntity.find({
      relations: ['tips'],
    });
  }

  async assignExerciseToWorkout(
    exerciseId: string,
    workoutId: string,
    userId: string,
  ) {
    return new Promise(async (resolve, reject) => {
      const canAssign = await this.exerciseEntity.manager.find(WorkoutEntity, {
        where: { workoutId, authorId: userId },
      });

      if (!canAssign.length)
        return reject('You are not the author of this workout');

      const isAssigned = await this.exerciseEntity.query(
        'SELECT * FROM workout_exercises WHERE workoutWorkoutId = ? AND exerciseExerciseId = ?',
        [workoutId, exerciseId],
      );

      if (isAssigned.length)
        return reject('Exercise already assigned to workout');

      this.exerciseEntity
        .query(
          'INSERT INTO workout_exercises(workoutWorkoutId,exerciseExerciseId) VALUES (?,?);',
          [workoutId, exerciseId],
        )
        .then((result) => resolve(true))
        .catch((error) =>
          reject('Error assigning exercise to workout: ' + error),
        );
    });
  }
}

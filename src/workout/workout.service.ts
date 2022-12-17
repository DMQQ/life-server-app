import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WorkoutEntity } from 'src/entities/workout.entity';
import { Repository } from 'typeorm';

@Injectable()
export class WorkoutService {
  constructor(
    @InjectRepository(WorkoutEntity)
    private workoutRepository: Repository<WorkoutEntity>,
  ) {}

  async createWorkout(userId: string, name: string, exercises: string[]) {
    const insertResult = await this.workoutRepository.insert({ userId, name });

    const workoutId = insertResult.identifiers[0].id as string;

    if (!exercises.length) return;

    if (typeof workoutId === 'undefined')
      throw new Error('Workout ID is undefined');

    const query =
      'INSERT INTO workout_exercises_exercise(workoutId,exerciseId) VALUES (?,?)';

    const promises = await Promise.all(
      exercises.map((exerciseId) =>
        this.workoutRepository.query(query, [workoutId, exerciseId]),
      ),
    );

    const isInsertSuccessful = promises.every(
      (promise) => promise.affectedRows > 0,
    );

    return { isInsertSuccessful, workoutId };
  }

  getWorkoutById(id: string) {
    return this.workoutRepository.findOne({
      where: {
        id,
      },
      relations: ['exercises', 'exercises.exercise_progress'],
    });
  }

  getWorkouts(userId: string) {
    return this.workoutRepository.find({
      where: { userId },
      relations: ['exercises', 'exercises.exercise_progress'],
    });
  }
}

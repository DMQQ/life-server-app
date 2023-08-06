import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ExerciseEntity,
  ExerciseProgressEntity,
  WorkoutEntity,
} from './workout.entity';
import { Repository } from 'typeorm';
import { CreateExercise } from './workout.dto';
import { StringDecoder } from 'string_decoder';
import * as moment from 'moment';

@Injectable()
export class ExerciseService {
  constructor(
    @InjectRepository(ExerciseEntity)
    private exerciseEntity: Repository<ExerciseEntity>,

    @InjectRepository(ExerciseProgressEntity)
    private progressEntity: Repository<ExerciseProgressEntity>,
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
      relations: ['tips', 'exerciseProgress'],
    });
  }

  async getExercises() {
    return await this.exerciseEntity.find({
      relations: ['tips', 'exerciseProgress'],
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

  getExerciseProgress(exerciseId: string, userId: string) {
    return this.progressEntity.find({
      where: {
        exerciseId,
        userId,
      },
      order: {
        date: 'DESC',
      },
    });
  }

  createExerciseProgress(
    data: Omit<ExerciseProgressEntity, 'date' | 'exerciseProgressId'>,
  ) {
    return this.progressEntity.insert({
      ...data,
      date: moment().format('YYYY-MM-DD'),
    });
  }

  getOneExerciseProgressById(progressId: string) {
    return this.progressEntity.findOne({
      where: {
        exerciseProgressId: progressId,
      },
    });
  }

  //

  // dokonczyc
  exerciseProgressStats(exerciseId: string, userId: string, range = 'week') {
    const maxWeight = async () =>
      this.progressEntity
        .createQueryBuilder('p')
        .select('MAX(p.weight)', 'max')
        .where('p.exerciseId = :exerciseId', { exerciseId })
        .andWhere('p.userId = userId', { userId })
        .getRawOne();

    const lastRecord = () =>
      this.progressEntity.find({
        where: { exerciseId, userId },
        select: ['date'],
        take: 1,
        order: { date: 'desc' },
      });

    const weightProgressInRange = async () => {
      const lastWeekSum = this.progressEntity
        .createQueryBuilder('p')
        .select('SUM(p.weight)')
        .where('p.date');
    };

    return Promise.all([maxWeight(), lastRecord()]);
  }
}

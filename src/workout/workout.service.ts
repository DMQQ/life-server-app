import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WorkoutEntity } from './workout.entity';
import { Repository } from 'typeorm';
import { CreateWorkout } from './workout.dto';

@Injectable()
export class WorkoutService {
  constructor(
    @InjectRepository(WorkoutEntity)
    private workoutEntity: Repository<WorkoutEntity>,
  ) {}

  private readonly RELATIONS = ['exercises', 'exercises.tips'];

  public async createWorkout(
    input: CreateWorkout & {
      userId: string;
    },
  ) {
    const workout = await this.workoutEntity.insert({
      description: input.description,
      title: input.title,
      difficulty: input.difficulty,
      type: input.type,
      authorId: input.userId,
    });

    return workout.identifiers[0].workoutId;
  }

  public async getWorkouts(userId: string) {
    return await this.workoutEntity.find({
      where: { authorId: userId },
      relations: this.RELATIONS,
    });
  }

  public async getWorkout(workoutId: string, userId: string) {
    return await this.workoutEntity.findOneOrFail({
      where: { workoutId, authorId: userId },
      relations: this.RELATIONS,
    });
  }
}

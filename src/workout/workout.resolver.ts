import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { WorkoutService } from './workout.service';
import { Type, WorkoutEntity, difficulty, type } from './workout.entity';
import { CreateWorkout } from './workout.dto';
import { User } from 'src/utils/decorators/User';
import {
  UseGuards,
  UsePipes,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import { ExerciseService } from './exercise.service';

@UseGuards(AuthGuard)
@Resolver()
export class WorkoutResolver {
  constructor(
    private workoutService: WorkoutService,
    private exerciseService: ExerciseService,
  ) {}

  @Mutation(() => WorkoutEntity)
  async createWorkout(
    @Args('input', { type: () => CreateWorkout, nullable: false })
    input: CreateWorkout,
    @User() userId: string,
  ) {
    if (!difficulty.includes(input.difficulty))
      throw new BadRequestException(
        'Difficulty must be Beginner, Intermediate or Advanced',
      );

    if (!type.includes(input.type))
      throw new BadRequestException('Invalid type');

    let workoutId: string;

    try {
      workoutId = await this.workoutService.createWorkout(
        Object.assign(input, { userId }),
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }

    try {
      if (input.exercises !== undefined) {
        const exercisePromiseArray = input.exercises.map((exerciseId) =>
          this.exerciseService.assignExerciseToWorkout(
            exerciseId,
            workoutId,
            userId,
          ),
        );

        await Promise.all(exercisePromiseArray);
      }

      return await this.workoutService.getWorkout(workoutId, userId);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Query(() => WorkoutEntity)
  async workout(
    @Args('id', { type: () => ID, nullable: false }) id: string,
    @User() usrId: string,
  ) {
    try {
      const workout = await this.workoutService.getWorkout(id, usrId);

      return workout;
    } catch (error) {
      throw new NotFoundException(
        `No workout with id ${id} found for your account`,
      );
    }
  }

  @Query(() => [WorkoutEntity])
  async workouts(@User() usrId: string) {
    return await this.workoutService.getWorkouts(usrId);
  }
}

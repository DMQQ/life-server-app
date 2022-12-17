import { Args, Mutation, Resolver, Query } from '@nestjs/graphql';
import { WorkoutService } from './workout.service';
import { User } from 'src/utils/decorators/User';
import { WorkoutEntity } from 'src/entities/workout.entity';
import { BadRequestException } from '@nestjs/common';
import { UseGuards } from '@nestjs/common/decorators';
import { AuthGuard } from 'src/utils/guards/AuthGuard';

@Resolver()
@UseGuards(AuthGuard)
export class WorkoutResolver {
  constructor(private workoutService: WorkoutService) {}

  @Mutation(() => WorkoutEntity)
  async createWorkout(
    @Args('name', { type: () => String, nullable: true }) name: string,
    @Args('exercises', { type: () => [String], nullable: false })
    exercises: string[],
    @User() userId: string,
  ) {
    const insert = await this.workoutService.createWorkout(
      userId,
      name,
      exercises,
    );

    if (!insert.isInsertSuccessful)
      throw new BadRequestException('Workout not created');

    return this.workoutService.getWorkoutById(insert.workoutId);
  }

  @Query(() => [WorkoutEntity])
  workouts(@User() userId: string) {
    return this.workoutService.getWorkouts(userId);
  }

  @Query(() => WorkoutEntity)
  workout(@Args('id', { type: () => String }) id: string) {
    return this.workoutService.getWorkoutById(id);
  }
}

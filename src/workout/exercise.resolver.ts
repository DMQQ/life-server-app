import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ExerciseService } from './exercise.service';
import { ExerciseEntity, ExerciseProgressEntity } from './workout.entity';
import { CreateExercise, CreateProgressInput } from './workout.dto';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { User } from 'src/utils/decorators/User';
import { AuthGuard } from 'src/utils/guards/AuthGuard';

@UseGuards(AuthGuard)
@Resolver()
export class ExerciseResolver {
  constructor(private exerciseService: ExerciseService) {}

  @Mutation(() => ExerciseEntity)
  async createExercise(
    @Args('input', { type: () => CreateExercise, nullable: false })
    input: CreateExercise,
  ) {
    if (!['Beginner', 'Intermediate', 'Advanced'].includes(input.difficulty))
      throw new BadRequestException(
        'Difficulty must be one of Beginner, Intermediate, or Advanced',
      );

    return this.exerciseService.createExercise(input);
  }

  @Query(() => [ExerciseEntity])
  async exercises() {
    return this.exerciseService.getExercises();
  }

  @Mutation(() => Boolean)
  async assignExerciseToWorkout(
    @Args('exerciseId') exerciseId: string,
    @Args('workoutId') workoutId: string,
    @User() usrId: string,
  ) {
    try {
      const uploaded = await this.exerciseService.assignExerciseToWorkout(
        exerciseId,
        workoutId,
        usrId,
      );

      return !!uploaded;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  @Query(() => [ExerciseProgressEntity])
  exerciseProgress(
    @User() usr: string,
    @Args('exerciseId', { type: () => ID }) exerciseId: string,
  ) {
    return this.exerciseService.getExerciseProgress(exerciseId, usr);
  }

  @Mutation(() => ExerciseProgressEntity)
  async createExerciseProgress(
    @User() usr: string,
    @Args('input', { type: () => CreateProgressInput })
    input: CreateProgressInput,
  ) {
    const insert = await this.exerciseService.createExerciseProgress({
      ...input,
      userId: usr,
    });

    const insertId = insert.generatedMaps[0]?.exerciseProgressId;
    return this.exerciseService.getOneExerciseProgressById(insertId);
  }

  @Query(() => Boolean)
  async exerciseProgressStats(
    @User() usr: string,
    @Args('exerciseId', { type: () => ID }) exerciseId: string,
  ) {
    const v = await this.exerciseService.exerciseProgressStats(exerciseId, usr);

    console.log(v);

    return false;
  }
}

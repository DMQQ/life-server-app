import {
  Args,
  Mutation,
  Resolver,
  Query,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { ExerciseService } from './exercise.service';
import { CreateExercise, CreateExerciseProgress } from './exercise.schemas';
import { ExerciseEntity } from 'src/entities/exercise.entity';
import { ExerciseProgressEntity } from 'src/entities/exercise_progress.entity';
import { User } from 'src/utils/decorators/User';

@Resolver(() => ExerciseEntity)
export class ExerciseResolver {
  constructor(private exerciseService: ExerciseService) {}

  @Mutation(() => String)
  async createExercise(
    @Args('exercise', { type: () => CreateExercise, nullable: false })
    exercise: CreateExercise,
  ) {
    const insertResult = await this.exerciseService.createExercise({
      ...exercise,
      image: '',
    });

    return insertResult.identifiers[0].id;
  }

  @Query(() => [ExerciseEntity])
  exercises() {
    return this.exerciseService.getExercises();
  }

  @Mutation(() => ExerciseProgressEntity)
  async createExerciseProgress(
    @User() userId: string,
    @Args('exercise', { type: () => CreateExerciseProgress, nullable: false })
    progress: CreateExerciseProgress,
  ) {
    const insertResult = await this.exerciseService.createProgress({
      ...progress,
      userId,
    });

    return this.exerciseService.getExerciseProgressById(
      insertResult.identifiers[0].id,
    );
  }

  /*   @ResolveField('exercise_progress', () => [ExerciseProgressEntity])
  async exerciseProgress(
    @User() userId: string,
    @Parent() parent: ExerciseEntity,
  ) {
    return this.exerciseService.getExerciseProgress(parent.id, userId);
  } */
}

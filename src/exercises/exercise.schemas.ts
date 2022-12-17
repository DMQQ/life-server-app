import { Field, ID, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateExercise {
  @Field()
  name: string;

  @Field()
  description: string;

  @Field()
  muscleGroup: string;
}

@InputType()
export class CreateExerciseProgress {
  @Field(() => ID)
  exerciseId: string;

  @Field(() => Int)
  reps: number;

  @Field(() => Int)
  sets: number;

  @Field(() => Int)
  weight: number;
}

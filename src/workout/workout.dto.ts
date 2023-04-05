import { Field, ID, InputType } from '@nestjs/graphql';
import { Difficulty, Type } from './workout.entity';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateWorkout {
  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => String)
  type: Type;

  @Field()
  difficulty: Difficulty;

  @Field(() => [ID], { nullable: true })
  exercises?: string[];
}

@InputType()
export class CreateExercise {
  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  difficulty: Difficulty;

  @Field()
  muscleGroup: string;

  @Field()
  equipment: string;
}

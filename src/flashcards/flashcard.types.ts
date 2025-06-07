import { InputType, Field, ID, Int, ObjectType, Float } from '@nestjs/graphql';

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

@InputType()
export class CreateFlashCardInput {
  @Field()
  question: string;

  @Field()
  answer: string;

  @Field({ nullable: true })
  explanation?: string;

  @Field(() => ID)
  groupId: string;
}

@InputType()
export class UpdateGroupInput {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;
}

@InputType()
export class UpdateFlashCardInput {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  question?: string;

  @Field({ nullable: true })
  answer?: string;

  @Field({ nullable: true })
  explanation?: string;

  @Field(() => Int, { nullable: true })
  difficultyLevel?: number;
}

@InputType()
export class ReviewFlashCardInput {
  @Field(() => ID)
  id: string;

  @Field()
  isCorrect: boolean;
}

@InputType()
export class CreateGroupInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @Field({ nullable: true })
  @IsString()
  description?: string;
}

@ObjectType()
export class GroupStats {
  @Field(() => Int)
  totalCards: number;
  @Field(() => Float)
  averageSuccessRate: number;

  @Field(() => Int)
  totalReviewed: number;
  @Field(() => Int)
  masteredCards: number;
}

@ObjectType()
export class AIGeneratedFlashCards {
  @Field()
  question: string;

  @Field()
  answer: string;

  @Field()
  explanation: string;
}

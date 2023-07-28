import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';

export const difficulty = ['Beginner', 'Intermediate', 'Advanced'];

export const type = [
  'Cardio',
  'Strength',
  'Flexibility',
  'PushPullLegs',
  'FullBodyWorkout',
  'Split',
  'Other',
];

export enum Difficulty {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
}

export enum Type {
  Cardio = 'Cardio',
  Strength = 'Strength',
  Flexibility = 'Flexibility',
  PushPullLegs = 'PushPullLegs',
  FullBodyWorkout = 'FullBodyWorkout',
  Split = 'Split',
  Other = 'Other',
}

@ObjectType()
@Entity('workout')
export class WorkoutEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  workoutId: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 100, nullable: false })
  title: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 255, nullable: false })
  description: string;

  @Field(() => String)
  @Column({ type: 'enum', enum: Type, default: Type.Other })
  type: string;

  @Field(() => String)
  @Column({ type: 'enum', enum: Difficulty, default: Difficulty.Beginner })
  difficulty: string;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'uuid', nullable: false })
  authorId: string;

  @Field(() => [ExerciseEntity])
  @ManyToMany(() => ExerciseEntity)
  @JoinTable({ name: 'workout_exercises' })
  exercises: ExerciseEntity[];
}

@ObjectType()
@Entity('exercise')
export class ExerciseEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  exerciseId: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 100, nullable: false })
  title: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 255, nullable: false })
  description: string;

  @Field(() => String)
  @Column({ type: 'enum', enum: Difficulty, default: Difficulty.Beginner })
  difficulty: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 100, nullable: false })
  muscleGroup: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 100, nullable: false })
  equipment: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  image: string;

  @Field(() => [TipsEntity])
  @OneToMany(() => TipsEntity, (tips) => tips.exerciseId)
  tips: TipsEntity[];

  @Field(() => [ExerciseProgressEntity])
  @OneToMany(
    () => ExerciseProgressEntity,
    (exerciseProgress) => exerciseProgress.exerciseId,
  )
  exerciseProgress: ExerciseProgressEntity[];
}

@ObjectType()
@Entity('tips')
export class TipsEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  tipId: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 255, nullable: false })
  text: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 100, nullable: false })
  image: string;

  @ManyToOne(() => ExerciseEntity, (exercise) => exercise.tips)
  @JoinColumn({ name: 'exerciseId' })
  exerciseId: string;
}

@ObjectType()
@Entity('exercise_progress')
export class ExerciseProgressEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  exerciseProgressId: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: '10' })
  date: string;

  @Field(() => Int)
  @Column({ type: 'int', nullable: false })
  sets: number;

  @Field(() => Int)
  @Column({ type: 'int', nullable: false })
  reps: number;

  @Field(() => Float)
  @Column({ type: 'float', nullable: false })
  weight: number;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @ManyToOne(() => ExerciseEntity, (exercise) => exercise.exerciseProgress)
  @JoinColumn({ name: 'exerciseId' })
  exerciseId: string;
}

import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExerciseEntity } from './exercise.entity';

@ObjectType()
@Entity('exercise_progress')
export class ExerciseProgressEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => Int)
  @Column({ type: 'int' })
  reps: number;

  @Field(() => Int)
  @Column({ type: 'int' })
  sets: number;

  @Field(() => Int)
  @Column({ type: 'double' })
  weight: number;

  @Column({ type: 'uuid' })
  userId: string;

  @Field(() => String)
  @Column({
    type: 'timestamp',
    insert: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  date: string;

  @Field(() => ID)
  @ManyToOne(() => ExerciseEntity, (exercise) => exercise.exercise_progress)
  exerciseId: string;
}

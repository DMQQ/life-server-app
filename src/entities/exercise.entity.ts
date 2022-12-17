import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExerciseProgressEntity } from './exercise_progress.entity';

@ObjectType()
@Entity('exercise')
export class ExerciseEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'varchar', length: '100', nullable: false })
  name: string;

  @Field()
  @Column({ type: 'varchar', length: '255', nullable: false })
  description: string;

  @Field()
  @Column({ type: 'varchar', length: '255', nullable: false })
  image: string;

  @Field()
  @Column({ type: 'varchar', length: '50', nullable: false })
  muscleGroup: string;

  @Field(() => [ExerciseProgressEntity])
  @OneToMany(
    () => ExerciseProgressEntity,
    (exerciseProgress) => exerciseProgress.exerciseId,
  )
  @JoinColumn({ name: 'exercise_progress' })
  exercise_progress: ExerciseProgressEntity[];
}

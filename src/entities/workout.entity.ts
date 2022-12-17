import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { ExerciseEntity } from './exercise.entity';

@ObjectType()
@Entity('workout')
export class WorkoutEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'varchar', nullable: true })
  name: string;

  @Field()
  @Column({
    type: 'datetime',
    insert: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  date: Date;

  @Field()
  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Field(() => [ExerciseEntity])
  @ManyToMany(() => ExerciseEntity)
  @JoinTable()
  exercises: ExerciseEntity[];
}

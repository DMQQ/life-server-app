import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@ObjectType()
@Entity('reminder')
export class ReminderEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'varchar', length: 255, nullable: false })
  title: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Field()
  @Column({ type: 'varchar', length: 255, nullable: false })
  description: string;

  @Field(() => String)
  @Column({ type: 'int', nullable: true })
  repeatEvery: number;

  @Field(() => Date)
  @Column({ type: 'varchar', nullable: true })
  exactDate: Date;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  isDone: boolean;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  isExactDate: boolean;

  @Field(() => Boolean)
  @Column({ type: 'boolean' })
  repeat: boolean;
}

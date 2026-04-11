import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventOccurrenceEntity } from './event-occurrence.entity';

@ObjectType()
@Entity('event_series')
export class EventSeriesEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Field()
  @Column({ type: 'text' })
  description: string;

  @Field({ nullable: true })
  @Column({ type: 'time', nullable: true })
  beginTime: string;

  @Field({ nullable: true })
  @Column({ type: 'time', nullable: true })
  endTime: string;

  @Field()
  @Column({ type: 'boolean', default: false })
  isAllDay: boolean;

  @Column({ type: 'boolean', default: true })
  notification: boolean;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Field()
  @Column({ type: 'varchar', length: 50, default: '' })
  tags: string;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  priority: number;

  @Field(() => ID)
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Field()
  @Column({ type: 'boolean', default: false })
  isRepeat: boolean;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  repeatFrequency: string;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  repeatEveryNth: number;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  repeatCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => EventOccurrenceEntity, (occ) => occ.series)
  occurrences: any[];
}

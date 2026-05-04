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

  // ── Legacy recurrence columns (kept for existing data migration) ──
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  repeatFrequency: string;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  repeatEveryNth: number;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  repeatCount: number;

  // ── New recurrence columns ──
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  repeatType: string; // 'DAILY' | 'WEEKLY' | 'MONTHLY'

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  repeatDaysOfWeek: string; // comma-separated day numbers: 0=Sun,1=Mon,...,6=Sat

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true, default: 1 })
  repeatInterval: number; // every N days/weeks/months (replaces repeatEveryNth)

  @Field({ nullable: true })
  @Column({ type: 'date', nullable: true })
  repeatUntil: string; // null = infinite, YYYY-MM-DD = stop on this date

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  reminderBeforeMinutes: number; // null = no reminder, N = notify N minutes before beginTime

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => EventOccurrenceEntity, (occ) => occ.series)
  occurrences: any[];
}

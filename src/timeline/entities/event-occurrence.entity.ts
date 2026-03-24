import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventSeriesEntity } from './event-series.entity';
import { OccurrenceTodoEntity } from './occurrence-todo.entity';
import { OccurrenceFileEntity } from './occurrence-file.entity';

@ObjectType()
@Entity('event_occurrence')
export class EventOccurrenceEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  seriesId: string;

  @Field()
  @Index()
  @Column({ type: 'date' })
  date: string;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  position: number;

  @Field()
  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Field()
  @Column({ type: 'boolean', default: false })
  isSkipped: boolean;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 150, nullable: true })
  titleOverride: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  descriptionOverride: string;

  @Field({ nullable: true })
  @Column({ type: 'time', nullable: true })
  beginTimeOverride: string;

  @Field({ nullable: true })
  @Column({ type: 'time', nullable: true })
  endTimeOverride: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Use 'any' for cross-file circular references to avoid emitDecoratorMetadata issues
  @ManyToOne(() => EventSeriesEntity, (series) => series.occurrences, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'seriesId' })
  series: any;

  @OneToMany(() => OccurrenceTodoEntity, (todo) => todo.occurrence, { cascade: true })
  todos: any[];

  @OneToMany(() => OccurrenceFileEntity, (file) => file.occurrence, { cascade: true })
  images: any[];

  @OneToOne('LiveActivityEntity', 'occurrence')
  liveActivity: any;
}

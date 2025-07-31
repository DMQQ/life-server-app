import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@ObjectType()
@Entity('timeline')
export class TimelineEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Field(() => String)
  @Column({ type: 'text' })
  description: string;

  @Field(() => String)
  @Column({ type: 'text', nullable: false })
  date: string;

  @Field(() => String)
  @Column({ type: 'time', nullable: true })
  beginTime: string;

  @Field(() => String)
  @Column({ type: 'time', nullable: true })
  endTime: string;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  isAllDay: boolean;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({ type: 'boolean', default: true })
  notification: boolean;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: false })
  isRepeat: boolean;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  userId: string;

  @Field(() => String)
  @Column({ type: 'varchar', default: '' })
  tags: string;

  @Field(() => [TimelineFilesEntity])
  @OneToMany(() => TimelineFilesEntity, (image) => image.timelineId)
  images: TimelineFilesEntity[];

  @Field(() => [TimelineTodosEntity])
  @OneToMany(() => TimelineTodosEntity, (todo) => todo.timelineId)
  todos: TimelineTodosEntity[];
}

@ObjectType()
@Entity('timeline_files')
export class TimelineFilesEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TimelineEntity, (timeline) => timeline.images)
  @JoinColumn({ name: 'timelineId' })
  timelineId: TimelineEntity;

  @Field(() => String)
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Field(() => String)
  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 100 })
  url: string;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  isPublic: boolean;
}

@ObjectType()
@Entity('timeline_todos')
export class TimelineTodosEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => String)
  @Column({ type: 'varchar' })
  title: string;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @ManyToOne(() => TimelineEntity, (timeline) => timeline.todos)
  @JoinColumn({ name: 'timelineId' })
  timelineId: string;

  @Field(() => Date)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => Date)
  @UpdateDateColumn()
  modifiedAt: Date;
}

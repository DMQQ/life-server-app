// Legacy file — superseded by entities in ./entities/
// @ObjectType() decorators removed to avoid duplicate GraphQL type names.
// This file exists only so the dead-code files (timeline.service.ts, timeline.resolver.ts) still compile.
// Do NOT register these classes in any NestJS module.

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LiveActivityEntity } from './live-activity.entity';

@Entity('timeline')
export class TimelineEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: false })
  date: string;

  @Column({ type: 'time', nullable: true })
  beginTime: string;

  @Column({ type: 'time', nullable: true })
  endTime: string;

  @Column({ type: 'boolean', default: false })
  isAllDay: boolean;

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

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', default: '' })
  tags: string;

  @OneToMany(() => TimelineFilesEntity, (image) => image.timelineId)
  images: TimelineFilesEntity[];

  @OneToMany(() => TimelineTodosEntity, (todo) => todo.timelineId)
  todos: TimelineTodosEntity[];

  @OneToOne(() => LiveActivityEntity)
  liveActivity: LiveActivityEntity;
}

@Entity('timeline_files')
export class TimelineFilesEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TimelineEntity, (timeline) => timeline.images)
  @JoinColumn({ name: 'timelineId' })
  timelineId: TimelineEntity;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Column({ type: 'varchar', length: 100 })
  url: string;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;
}

@Entity('timeline_todos')
export class TimelineTodosEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @ManyToOne(() => TimelineEntity, (timeline) => timeline.todos)
  @JoinColumn({ name: 'timelineId' })
  timelineId: string;

  @OneToMany(() => TodoFilesEntity, (file) => file.todoId, { cascade: true })
  files: TodoFilesEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  modifiedAt: Date;
}

@Entity('timeline_todo_files_legacy')
export class TodoFilesEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TimelineTodosEntity, (todo) => todo.files)
  @JoinColumn({ name: 'todoId' })
  todoId: string;

  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Column({ type: 'varchar', length: 255 })
  url: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

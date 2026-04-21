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
@Entity('occurrence_todos')
export class OccurrenceTodoEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  occurrenceId: string;

  @Field()
  @Column({ type: 'varchar' })
  title: string;

  @Field()
  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @ManyToOne('EventOccurrenceEntity', 'todos', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'occurrenceId' })
  occurrence: any;

  @Field(() => [TodoFilesEntity])
  @OneToMany(() => TodoFilesEntity, (file) => file.todo, { cascade: true })
  files: any[];

  @Field(() => Date)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => Date)
  @UpdateDateColumn()
  modifiedAt: Date;
}

@ObjectType()
@Entity('todo_files')
export class TodoFilesEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  todoId: string;

  @Field()
  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Field()
  @Column({ type: 'varchar', length: 255 })
  url: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => OccurrenceTodoEntity, (todo) => todo.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'todoId' })
  todo: OccurrenceTodoEntity;
}

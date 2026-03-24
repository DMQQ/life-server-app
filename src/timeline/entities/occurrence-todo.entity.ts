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

// OccurrenceTodoEntity defined FIRST so TodoFilesEntity can reference it without
// a "before initialization" error from emitDecoratorMetadata.

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

  // ManyToOne to EventOccurrenceEntity — use string name to avoid circular import
  @ManyToOne('EventOccurrenceEntity', 'todos', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'occurrenceId' })
  occurrence: any;

  // files referenced lazily; property typed `any[]` to avoid forward-reference error
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

// TodoFilesEntity defined SECOND — its `todo` property can safely reference
// OccurrenceTodoEntity because it is already initialized above.

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

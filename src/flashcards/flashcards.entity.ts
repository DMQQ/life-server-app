// src/flashcards/entities/flashcards.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';

@Entity('groups')
@ObjectType()
export class Group {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column()
  @Field()
  name: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  description?: string;

  @Column({ name: 'user_id' })
  userId: string;

  @OneToMany(() => FlashCard, (flashcard) => flashcard.group)
  @Field(() => [FlashCard])
  flashcards: FlashCard[];

  @CreateDateColumn({ name: 'created_at' })
  @Field()
  createdAt: Date;
}

@Entity('flashcards')
@ObjectType()
export class FlashCard {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column()
  @Field()
  question: string;

  @Column()
  @Field()
  answer: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  explanation?: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'times_reviewed', default: 0 })
  @Field(() => Int)
  timesReviewed: number;

  @Column({ name: 'correct_answers', default: 0 })
  @Field(() => Int)
  correctAnswers: number;

  @Column({ name: 'incorrect_answers', default: 0 })
  @Field(() => Int)
  incorrectAnswers: number;

  @Column({ name: 'success_rate', type: 'float', default: 0 })
  @Field(() => Float)
  successRate: number;

  @Column({ name: 'last_reviewed_at', type: 'timestamp', nullable: true })
  @Field({ nullable: true })
  lastReviewedAt?: Date;

  @Column({ name: 'difficulty_level', default: 1 })
  @Field(() => Int)
  difficultyLevel: number;

  @ManyToOne(() => Group, (group) => group.flashcards)
  @JoinColumn({ name: 'group_id' }) // Specify the exact column name
  @Field(() => Group)
  group: Group;

  @CreateDateColumn({ name: 'created_at' })
  @Field()
  createdAt: Date;
}

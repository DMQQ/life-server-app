import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
@Entity('user_goal')
export class UserGoal {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  userId: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => [GoalCategory])
  @OneToMany(() => GoalCategory, (category) => category.userGoal)
  categories: GoalCategory[];
}

@ObjectType()
@Entity('goal_category')
export class GoalCategory {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  name: string;

  @Field()
  @Column()
  icon: string;

  @Field()
  @Column()
  description: string;

  @Column({ type: 'float', default: 0 })
  @Field(() => Int)
  target: number;

  @Column({ type: 'float', default: 0 })
  @Field(() => Int)
  min: number;

  @Column({ type: 'float', default: 0 })
  @Field(() => Int)
  max: number;

  @Field(() => String, { nullable: true })
  @Column()
  unit: string;

  @Field(() => UserGoal)
  @ManyToOne(() => UserGoal, (goal) => goal.categories)
  @JoinColumn({ name: 'goalId' }) // Match existing column name
  userGoal: UserGoal;

  @Field()
  @Column({ name: 'goalId' }) // Match existing column name
  userGoalId: string;

  @Field(() => [GoalEntry])
  @OneToMany(() => GoalEntry, (entry) => entry.category)
  entries: GoalEntry[];
}

@ObjectType()
@Entity('goal_entry')
export class GoalEntry {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column('float')
  value: number;

  @Field()
  @Column('timestamp')
  date: Date;

  @Field(() => GoalCategory)
  @ManyToOne(() => GoalCategory, (category) => category.entries)
  @JoinColumn({ name: 'goalsId' }) // Match existing column name
  category: GoalCategory;

  @Field()
  @Column({ name: 'goalsId' }) // Match existing column name
  categoryId: string;
}

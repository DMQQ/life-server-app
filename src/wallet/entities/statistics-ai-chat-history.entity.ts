import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class AiChatHistorySkill {
  @Field(() => String)
  type: string;

  @Field(() => String, { nullable: true })
  subtype?: string;

  @Field(() => String, { nullable: true })
  chartData?: string;

  @Field(() => String, { nullable: true })
  expenseId?: string;

  @Field(() => String, { nullable: true })
  subscriptionId?: string;
}

@ObjectType()
@Entity('statistics_ai_chat_history')
export class StatisticsAiChatHistoryEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Field(() => String)
  @Column({ type: 'text' })
  userMessage: string;

  @Field(() => String)
  @Column({ type: 'text' })
  aiMessage: string;

  @Field(() => [String])
  @Column({ type: 'json' })
  statTypes: string[];

  @Field(() => [AiChatHistorySkill])
  @Column({ type: 'json' })
  skills: AiChatHistorySkill[];

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  startDate: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  endDate: string;

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

// Raw AI message items stored in DB (IDs only, no resolved entities)
export interface AiMessageRaw {
  type: 'text' | 'chart' | 'expense' | 'subscription';
  content?: string;
  subtype?: string;
  chartData?: string;
  id?: string;
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

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  aiMessage: string;

  @Field(() => [String])
  @Column({ type: 'json' })
  statTypes: string[];

  @Column({ type: 'json', nullable: true })
  aiMessages: AiMessageRaw[];

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

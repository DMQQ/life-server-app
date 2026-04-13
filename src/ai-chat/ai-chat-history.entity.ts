import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface AiMessageRaw {
  type: 'text' | 'chart' | 'expense' | 'subscription' | 'event' | 'goal' | 'flashcard';
  content?: string;
  subtype?: string;
  chartData?: string;
  id?: string;
}

@Entity('ai_chat_history')
export class AiChatHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  userMessage: string;

  @Column({ type: 'json', nullable: true })
  aiMessages: AiMessageRaw[];

  @Column({ type: 'varchar', nullable: true })
  startDate: string;

  @Column({ type: 'varchar', nullable: true })
  endDate: string;

  @CreateDateColumn()
  createdAt: Date;
}

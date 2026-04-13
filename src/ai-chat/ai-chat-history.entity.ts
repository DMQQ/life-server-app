import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface AiMessageRaw {
  type: 'text' | 'chart' | 'expense' | 'subscription' | 'event' | 'goal' | 'flashcard' | 'timelineWidget';
  content?: string;
  subtype?: string;
  id?: string;
  toolParams?: any;
  data?: string;
}

@Entity('ai_chat_history')
export class AiChatHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  walletId: string;

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

import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EventOccurrenceEntity } from './entities/event-occurrence.entity';

export enum LiveActivityStatus {
  PENDING = 'pending',
  SENT = 'sent',
  UPDATE = 'update',
  END = 'end',
}

@Entity('live_activities')
export class LiveActivityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint' })
  beginTime: number;

  @Column({ type: 'bigint' })
  endTime: number;

  @Column({
    type: 'enum',
    enum: LiveActivityStatus,
    default: LiveActivityStatus.PENDING,
  })
  status: LiveActivityStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updateToken: string;

  @Column({ type: 'bigint', default: 0 })
  lastUpdated: number;

  @Column({ type: 'uuid' })
  occurrenceId: string;

  @OneToOne(() => EventOccurrenceEntity, (occ) => occ.liveActivity)
  @JoinColumn({ name: 'occurrenceId' })
  occurrence: EventOccurrenceEntity;
}

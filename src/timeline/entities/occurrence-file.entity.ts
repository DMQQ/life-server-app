import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@ObjectType()
@Entity('occurrence_files')
export class OccurrenceFileEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  occurrenceId: string;

  @Field()
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Field()
  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Field()
  @Column({ type: 'varchar', length: 255 })
  url: string;

  @Field()
  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('EventOccurrenceEntity', 'images', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'occurrenceId' })
  occurrence: any;
}

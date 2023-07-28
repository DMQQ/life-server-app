import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
@Entity('notifications')
export class NotificationsEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 60, nullable: false })
  token: string;

  @Field(() => String)
  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  isEnable: boolean;
}

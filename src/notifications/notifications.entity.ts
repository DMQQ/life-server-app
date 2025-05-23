import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

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

@ObjectType()
@Entity('notifications_history')
export class NotificationsHistoryEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => GraphQLJSON)
  @Column('json')
  message: Record<string, any>;

  @Field(() => ID)
  @Column('uuid')
  userId: string;

  @Field(() => Date)
  @Column('timestamp')
  sendAt: Date;

  @Field(() => Boolean)
  @Column('boolean', { default: false })
  read: boolean;

  @Field(() => String)
  @Column('varchar', { nullable: true })
  type: string;
}

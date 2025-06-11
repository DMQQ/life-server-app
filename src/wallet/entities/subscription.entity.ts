import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { ExpenseEntity } from '../entities/wallet.entity';

export enum BillingCycleEnum {
  DAILY = 'daily',

  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Entity('subscriptions')
@ObjectType()
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column({ type: 'float', nullable: false })
  @Field(() => Float)
  amount: number;

  @Column({ type: 'timestamp', nullable: false })
  @Field(() => String)
  dateStart: Date;

  @Column({ type: 'timestamp', nullable: true })
  @Field(() => String, { nullable: true })
  dateEnd: Date;

  @Column({ type: 'text', nullable: false })
  @Field(() => String)
  description: string;

  @Column({ type: 'boolean', nullable: false })
  @Field(() => Boolean)
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: false })
  @Field(() => String)
  nextBillingDate: Date;

  @Column({
    type: 'enum',
    nullable: false,
    enum: BillingCycleEnum,
    default: BillingCycleEnum.MONTHLY,
  })
  @Field(() => String)
  billingCycle: BillingCycleEnum;

  @OneToMany(() => ExpenseEntity, (expense) => expense.subscription)
  @Field(() => [ExpenseEntity])
  expenses: ExpenseEntity[];

  @Column({ type: 'uuid', nullable: false })
  @Field(() => ID)
  walletId: string;
}

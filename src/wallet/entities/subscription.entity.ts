import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { ExpenseEntity } from '../entities/wallet.entity';

export enum BillingCycleEnum {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
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

  @Column({ type: 'int', nullable: true, default: null })
  @Field(() => Int, { nullable: true })
  billingDay: number | null;

  @Column({ type: 'json', nullable: true, default: null })
  @Field(() => [Int], { nullable: true })
  customBillingMonths: number[] | null;

  @Column({ type: 'int', nullable: false, default: 3 })
  @Field(() => Int)
  reminderDaysBeforehand: number;

  @OneToMany(() => ExpenseEntity, (expense) => expense.subscription, { eager: true })
  @Field(() => [ExpenseEntity])
  expenses: ExpenseEntity[];

  @Field(() => Float)
  totalSpent: number;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => Int)
  totalDuration: number;

  @Column({ type: 'uuid', nullable: false })
  @Field(() => ID)
  walletId: string;

  static formatDate(date: Date | string) {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }
}

import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ObjectType, Field, Int, ID, Float } from '@nestjs/graphql';
import { SubscriptionEntity } from './subscription.entity';

@ObjectType()
@Entity('wallet')
export class WalletEntity {
  @Field((type) => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'float', nullable: false, default: 0 })
  @Field((type) => Float)
  balance: number;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Field((type) => [ExpenseEntity])
  @OneToMany((type) => ExpenseEntity, (expense) => expense.walletId)
  @JoinColumn({ name: 'expenses' })
  expenses: ExpenseEntity[];
}

@ObjectType()
@Entity('expense_locations')
export class ExpenseLocationEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => Float)
  @Column({ type: 'decimal', nullable: true })
  longitude: number;

  @Field(() => Float)
  @Column({ type: 'decimal', nullable: true })
  latitude: number;

  @Field()
  @Column()
  name: string;

  @Field()
  @Column()
  kind: string;

  @Field(() => [ExpenseEntity])
  @OneToMany(() => ExpenseEntity, (expense) => expense.location)
  expenses: ExpenseEntity[];
}

export enum ExpenseType {
  expense = 'expense',
  income = 'income',
  refunded = 'refunded',
}

@ObjectType()
@Entity('expense')
export class ExpenseEntity {
  @Field((type) => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'float', nullable: false })
  @Field((type) => Float)
  amount: number;

  @Column({ type: 'varchar', nullable: false })
  @Field((type) => String)
  description: string;

  @ManyToOne(() => WalletEntity, (wallet) => wallet.expenses)
  @JoinColumn({ name: 'walletId' })
  walletId: string;

  @Column({ type: 'timestamp', nullable: false })
  @Field((type) => Date)
  date: Date;

  @Column({ type: 'enum', enum: ExpenseType, nullable: false })
  @Field((type) => String)
  type: ExpenseType;

  @Column({ type: 'varchar', nullable: true })
  @Field((type) => String, { nullable: true })
  category: string;

  @Field((type) => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  balanceBeforeInteraction: number;

  @Field((type) => Boolean)
  @Column({ type: 'boolean', nullable: false, default: false })
  schedule: boolean;

  @Field(() => [ExpenseFileEntity], { defaultValue: [] })
  @OneToMany(() => ExpenseFileEntity, (file) => file.expenseId)
  @JoinColumn({ name: 'files' })
  files: ExpenseFileEntity[];

  @ManyToOne(() => SubscriptionEntity, (subscription) => subscription.expenses)
  @JoinColumn({ name: 'subscriptionId' })
  @Field(() => SubscriptionEntity, { nullable: true })
  subscription: SubscriptionEntity;

  @Field(() => String, { nullable: true })
  @Column({ name: 'subscriptionId', type: 'uuid', nullable: true })
  subscriptionId: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 255 })
  note: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar' })
  shop: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 255 })
  tags: string;

  @ManyToOne(() => ExpenseLocationEntity, (location) => location.expenses)
  @JoinColumn({ name: 'locationId' })
  @Field(() => ExpenseLocationEntity, { nullable: true })
  location: ExpenseLocationEntity;
}

@ObjectType()
@Entity('expense_file')
export class ExpenseFileEntity {
  @Field((type) => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: false })
  @Field((type) => String)
  url: string;

  @ManyToOne(() => ExpenseEntity, (expense) => expense.files)
  @JoinColumn({ name: 'expenseId' })
  expenseId: ExpenseEntity;
}

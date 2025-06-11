import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId } from 'typeorm';
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

  @Field(() => Float)
  @Column({ type: 'float' })
  income: number;

  @Field(() => Float)
  @Column({ type: 'float' })
  monthlyPercentageTarget: number;

  @Field((type) => [ExpenseEntity])
  @OneToMany((type) => ExpenseEntity, (expense) => expense.walletId)
  @JoinColumn({ name: 'expenses' })
  expenses: ExpenseEntity[];

  @Field(() => [WalletLimits])
  @OneToMany(() => WalletLimits, (limit) => limit.walletId)
  @JoinColumn({ name: 'limits' })
  limits: WalletLimits[];
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

  @Field(() => Float, { nullable: true, defaultValue: 0 })
  @Column({ type: 'float' })
  spontaneousRate: number;

  @ManyToOne(() => ExpenseLocationEntity, (location) => location.expenses)
  @JoinColumn({ name: 'locationId' })
  @Field(() => ExpenseLocationEntity, { nullable: true })
  location: ExpenseLocationEntity;

  @OneToMany(() => ExpenseSubExpense, (sub) => sub.expense)
  @Field(() => [ExpenseSubExpense])
  subexpenses: ExpenseSubExpense[];
}

@ObjectType()
@Entity('expense_subexpenses')
export class ExpenseSubExpense {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'varchar' })
  description: string;

  @Field(() => Float)
  @Column({ type: 'float' })
  amount: number;

  @Field(() => String)
  @Column({ type: 'varchar' })
  category: string;

  @ManyToOne(() => ExpenseEntity, (expense) => expense.subexpenses)
  @JoinColumn({ name: 'expenseId' })
  expense: ExpenseEntity;

  @RelationId((sub: ExpenseSubExpense) => sub.expense)
  @Field(() => ID)
  @Column({ type: 'uuid' })
  expenseId: string;
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

export enum LimitRange {
  'weekly' = 'weekly',
  'daily' = 'daily',

  'monthly' = 'monthly',

  'yearly' = 'yearly',
}

@ObjectType()
@Entity('wallet_limits')
export class WalletLimits {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'varchar', nullable: false })
  category: string;

  @Field(() => Float)
  @Column({ type: 'float' })
  amount: number;

  @Field()
  @Column({ type: 'enum', enum: LimitRange, default: LimitRange.monthly })
  type: LimitRange;

  @Field(() => Boolean)
  @Column({ type: 'boolean' })
  isAutoGenerated: boolean;

  @Column('uuid', { nullable: false })
  walletId: string;
}

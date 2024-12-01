import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ObjectType, Field, Int, ID, Float } from '@nestjs/graphql';

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

  @Field(() => [ExpenseFileEntity])
  @OneToMany(() => ExpenseFileEntity, (file) => file.expenseId)
  @JoinColumn({ name: 'files' })
  files: ExpenseFileEntity[];

  // new fields to be implemented

  @Field((type) => Boolean, { nullable: false })
  @Column({ type: 'boolean', default: false })
  refunded: boolean;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 255 })
  note: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar' })
  shop: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 255 })
  tags: string;
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

  @Column({ type: 'uuid', nullable: false })
  @Field((type) => ID)
  expenseId: string;
}

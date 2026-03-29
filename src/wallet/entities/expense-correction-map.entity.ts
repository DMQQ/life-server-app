import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { WalletEntity } from './wallet.entity';

@ObjectType()
@Entity('expense_correction_map')
export class ExpenseCorrectionMapEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  walletId: string;

  @ManyToOne(() => WalletEntity)
  @JoinColumn({ name: 'walletId' })
  wallet: WalletEntity;

  // Match conditions — AND logic: all non-null conditions must match
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  matchShop: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  matchDescription: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  matchCategory: string | null;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'float', nullable: true })
  matchAmountMin: number | null;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'float', nullable: true })
  matchAmountMax: number | null;

  // Overrides — null means "don't change"
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  overrideShop: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  overrideCategory: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  overrideDescription: string | null;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Field(() => Date)
  @CreateDateColumn()
  createdAt: Date;
}

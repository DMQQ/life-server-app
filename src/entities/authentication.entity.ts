import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Exclude } from 'class-transformer';

@ObjectType()
@Entity('users')
export class UsersEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: false, select: false })
  password: string;

  @Field(() => Int)
  @Column({ type: 'int', nullable: true })
  phone: number;

  @Field(() => String)
  @Column({ type: 'varchar', length: 60 })
  firstName: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 60 })
  lastName: string;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  age: number;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  isBlocked: boolean;

  @Field(() => Boolean)
  @Column({ type: 'boolean', default: false })
  is2Auth: boolean;

  @Field(() => Date)
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

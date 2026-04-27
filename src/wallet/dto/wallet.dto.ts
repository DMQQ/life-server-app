import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';
import { ExpenseType } from '../entities/wallet.entity';
import { CreateSubExpenseDto } from '../types/expense.schemas';
import { parseFieldToDate } from 'src/utils/middlewares/graphql/parse-field-to-date.middleware';

@ObjectType()
export class TransferResult {
  @Field(() => ID)
  from: string;

  @Field(() => ID)
  to: string;

  @Field(() => Float)
  amount: number;
}

@InputType()
export class CreateSubAccountInput {
  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  color?: string;

  @Field(() => String, { nullable: true })
  icon?: string;

  @Field(() => Float, { nullable: true })
  balance?: number;
}

@InputType()
export class UpdateSubAccountInput {
  @Field({ nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  color?: string;

  @Field(() => String, { nullable: true })
  icon?: string;

  @Field(() => Float, { nullable: true })
  balance?: number;
}

@InputType()
export class CreateExpenseInput {
  @Field(() => Float)
  amount: number;

  @Field(() => String)
  description: string;

  @Field(() => String)
  type: ExpenseType;

  @Field(() => String)
  category: string;

  @Field(() => String)
  date: string;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  schedule?: boolean;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  isSubscription?: boolean;

  @Field(() => Float, { nullable: true })
  spontaneousRate?: number;

  @Field(() => ID, { nullable: true })
  subAccountId?: string;
}

@InputType()
export class CreateShortcutExpenseInput {
  @Field(() => Float)
  amount: number;

  @Field(() => String)
  description: string;

  @Field(() => Float, { nullable: true })
  latitude?: number;

  @Field(() => Float, { nullable: true })
  longitude?: number;
}

@InputType()
export class EditWalletBalanceInput {
  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field(() => Float, { nullable: true })
  paycheck?: number;

  @Field(() => String, { nullable: true })
  paycheckDate?: string;
}

@InputType()
export class EditExpenseInput {
  @Field(() => ID)
  expenseId: string;

  @Field(() => Float)
  amount: number;

  @Field(() => String)
  description: string;

  @Field(() => String)
  type: ExpenseType;

  @Field(() => String)
  category: string;

  @Field(() => String, { middleware: [parseFieldToDate] })
  date: string;

  @Field(() => Float, { nullable: true })
  spontaneousRate?: number;

  @Field(() => ID, { nullable: true })
  subAccountId?: string;
}

@InputType()
export class EditExpenseNoteInput {
  @Field(() => ID)
  expenseId: string;

  @Field(() => String)
  note: string;
}

@InputType()
export class TransferBetweenSubAccountsInput {
  @Field(() => ID)
  fromId: string;

  @Field(() => ID)
  toId: string;

  @Field(() => Float)
  amount: number;
}

@InputType()
export class AddExpenseLocationInput {
  @Field(() => ID)
  expenseId: string;

  @Field(() => ID)
  locationId: string;
}

@InputType()
export class AssignExpenseToSubscriptionInput {
  @Field(() => ID)
  expenseId: string;

  @Field(() => ID, { nullable: true })
  subscriptionId?: string;
}

@InputType()
export class CreateSubExpenseArgsInput {
  @Field(() => ID)
  expenseId: string;

  @Field(() => CreateSubExpenseDto)
  input: CreateSubExpenseDto;
}

@InputType()
export class AddMultipleSubExpensesInput {
  @Field(() => ID)
  expenseId: string;

  @Field(() => [CreateSubExpenseDto])
  inputs: CreateSubExpenseDto[];
}

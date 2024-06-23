import {
  Args,
  Float,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import { WalletService } from './wallet.service';
import {
  ExpenseEntity,
  ExpenseType,
  WalletEntity,
} from 'src/wallet/wallet.entity';
import { User } from 'src/utils/decorators/User';

@UseGuards(AuthGuard)
@Resolver(() => WalletEntity)
export class WalletResolver {
  constructor(private walletService: WalletService) {}

  @Query((returns) => WalletEntity)
  async wallet(@User() usrId: string) {
    return await this.walletService.getWalletByUserId(usrId);
  }

  @Mutation((returns) => ExpenseEntity)
  async createExpense(
    @User() usrId: string,
    @Args('amount', { type: () => Float }) amount: number,
    @Args('description') description: string,
    @Args('type', { type: () => String }) type: ExpenseType,
    @Args('category', { type: () => String }) category: string,
    @Args('date') date: string,
  ) {
    const parsedDate = new Date(date || new Date());

    const expense = await this.walletService.createExpense(
      usrId,
      amount,
      description,
      type,
      category,
      parsedDate,
    );

    return expense;
  }

  @Mutation(() => ID)
  async deleteExpense(
    @Args('id', { type: () => ID }) id: string,
    @User() userId: string,
  ) {
    await this.walletService.deleteExpense(id, userId);

    return id;
  }

  @Mutation(() => WalletEntity)
  async editWalletBalance(
    @User() usrId: string,
    @Args('amount', { type: () => Int }) amount: number,
  ) {
    return await this.walletService.editUserWalletBalance(usrId, amount);
  }

  @Mutation(() => ExpenseEntity)
  async editExpense(
    @User() usrId: string,
    @Args('expenseId', { type: () => ID }) expenseId: string,
    @Args('amount', { type: () => Float }) amount: number,
    @Args('description') description: string,
    @Args('type', { type: () => String }) type: ExpenseType,
    @Args('category', { type: () => String }) category: string,
  ) {
    const result = await this.walletService.editExpense(expenseId, usrId, {
      amount,
      description,
      type,
      category,
    });

    return result;
  }

  @Query(() => Int)
  async getMonthTotalExpenses(@User() usrId: string) {
    return await this.walletService.getMonthTotalByType(
      'expense',
      usrId,
      new Date().getMonth(),
      new Date().getFullYear(),
    );
  }

  @Query(() => Int)
  async getMonthTotal(@User() usrId: string) {
    const expenses = this.walletService.getMonthTotalByType(
      'expense',
      usrId,
      new Date().getMonth(),
      new Date().getFullYear(),
    );

    const incomes = this.walletService.getMonthTotalByType(
      'income',
      usrId,
      new Date().getMonth(),
      new Date().getFullYear(),
    );

    const promise = await Promise.all([expenses, incomes]);

    return promise[1] - promise[0];
  }
}

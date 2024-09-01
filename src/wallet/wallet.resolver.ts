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
import { BadRequestException, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import { WalletService } from './wallet.service';
import {
  ExpenseEntity,
  ExpenseType,
  WalletEntity,
} from 'src/wallet/wallet.entity';
import { User } from 'src/utils/decorators/User';
import { GetWalletFilters, WalletStatisticsRange } from './wallet.schemas';

@UseGuards(AuthGuard)
@Resolver(() => WalletEntity)
export class WalletResolver {
  constructor(private walletService: WalletService) {}

  @Query((returns) => WalletEntity)
  async wallet(@User() usrId: string) {
    return this.walletService.getWalletByUserId(usrId);
  }

  @ResolveField(() => [ExpenseEntity])
  async expenses(
    @Parent() wallet: WalletEntity,
    @Args('skip', { type: () => Int, nullable: true }) skip: number = 0,
    @Args('take', { type: () => Int, nullable: true }) take: number = 10,
    @Args('filters', { nullable: true, type: () => GetWalletFilters })
    filters: GetWalletFilters,
  ) {
    return this.walletService.getExpensesByWalletId(wallet.id, {
      pagination: { skip, take },
      where: filters,
    });
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
    @Args('date') date: string,
  ) {
    const result = await this.walletService.editExpense(expenseId, usrId, {
      amount,
      description,
      type,
      category,
      date,
    });

    return result;
  }

  @Query(() => Float)
  async getMonthTotalExpenses(@User() usrId: string) {
    return await this.walletService.getMonthTotalByType(
      'expense',
      usrId,
      new Date().getMonth(),
      new Date().getFullYear(),
    );
  }

  @Query(() => Float)
  async getMonthTotal(@User() usrId: string, @Args('date') date: string) {
    const parsedDate = new Date(date);

    const expenses = this.walletService.getMonthTotalByType(
      ExpenseType.expense,
      usrId,
      parsedDate.getMonth(),
      parsedDate.getFullYear(),
    );

    const incomes = this.walletService.getMonthTotalByType(
      ExpenseType.income,
      usrId,
      parsedDate.getMonth(),
      parsedDate.getFullYear(),
    );

    const promise = await Promise.all([expenses, incomes]);

    return promise[1] - promise[0];
  }

  @Query(() => WalletStatisticsRange)
  async getStatistics(
    @User() usrId: string,
    @Args('type', { type: () => String, description: 'today, month, week' })
    type: 'today' | 'month' | 'week',
  ) {
    if (['today', 'month', 'week'].indexOf(type) === -1)
      throw new BadRequestException('Invalid type');
    const stats = await this.walletService.getStatistics(usrId, type);

    return stats[0];
  }
}

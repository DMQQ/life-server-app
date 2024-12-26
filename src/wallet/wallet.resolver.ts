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
import {
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
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
    const wallet = await this.walletService.getWalletByUserId(usrId);

    return wallet ? wallet : new NotFoundException('Wallet may not exist');
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
    @Args('schedule', { type: () => Boolean, nullable: true }) schedule = false,
  ) {
    const parsedDate = new Date(date || new Date());

    const expense = await this.walletService.createExpense(
      usrId,
      amount,
      description,
      type,
      category,
      parsedDate,
      schedule,
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
      date: new Date(date),
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

  @Mutation(() => Boolean)
  async createWallet(
    @User() user: string,
    @Args('balance', { type: () => Float, nullable: false, defaultValue: 0 })
    initialBalance: number,
  ) {
    try {
      await this.walletService.createWallet(user, initialBalance);

      return true;
    } catch (error) {
      throw new BadRequestException(error);
    }
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
    @Args('range', { type: () => [String, String] }) range: [string, string],
  ) {
    if (range.length !== 2) {
      throw new BadRequestException('Invalid range');
    }

    if (new Date(range[0]) > new Date(range[1])) {
      throw new BadRequestException('Invalid range');
    }

    const stats = await this.walletService.getStatistics(usrId, range);

    return stats[0];
  }

  @Mutation(() => ExpenseEntity)
  async refundExpense(
    @User() user: string,
    @Args('expenseId', { type: () => ID, nullable: false }) expenseId: string,
  ) {
    try {
      return this.walletService.refundExpense(user, expenseId);
    } catch (error) {
      throw new BadRequestException('Refund failed');
    }
  }
}

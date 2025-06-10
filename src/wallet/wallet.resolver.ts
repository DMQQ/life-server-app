import { Args, Float, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { BadRequestException, NotFoundException, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/utils/guards/AuthGuard';
import { WalletService } from './wallet.service';
import { ExpenseEntity, ExpenseType, WalletEntity } from 'src/wallet/wallet.entity';
import { User } from 'src/utils/decorators/User';
import { GetWalletFilters, WalletStatisticsRange } from './wallet.schemas';
import { SubscriptionService } from './subscriptions.service';
import { BillingCycleEnum } from './subscription.entity';
import { OpenAIService } from 'src/utils/services/OpenAI/openai.service';
import { ExpenseService } from './expense.service';
import { Cache, InvalidateCache, UserCache } from '../utils/services/Cache/cache.decorator';

const parseDate = (dateString: string) => {
  const currentTime = new Date();
  const inputDate = new Date(dateString);

  return new Date(
    inputDate.getFullYear(),
    inputDate.getMonth(),
    inputDate.getDate(),
    currentTime.getHours(),
    currentTime.getMinutes(),
    currentTime.getSeconds(),
    currentTime.getMilliseconds(),
  );
};

@UseGuards(AuthGuard)
@Resolver(() => WalletEntity)
export class WalletResolver {
  constructor(
    private walletService: WalletService,
    private subscriptionService: SubscriptionService,
    private openAiService: OpenAIService,

    private expenseService: ExpenseService,
  ) {}

  @Query((returns) => WalletEntity)
  @UserCache(30)
  async wallet(@User() usrId: string) {
    const wallet = await this.walletService.getWalletByUserId(usrId);

    return wallet ? wallet : new NotFoundException('Wallet may not exist');
  }

  @ResolveField(() => [ExpenseEntity])
  @UserCache(30)
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
      isExactCategory: filters?.isExactCategory,
    });
  }

  @Mutation((returns) => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser:true })
  async createExpense(
    @User() usrId: string,
    @Args('amount', { type: () => Float }) amount: number,
    @Args('description') description: string,
    @Args('type', { type: () => String }) type: ExpenseType,
    @Args('category', { type: () => String }) category: string,
    @Args('date') date: string,
    @Args('schedule', { type: () => Boolean, nullable: true }) schedule = false,
    @Args('isSubscription', {
      type: () => Boolean,
      nullable: true,
      defaultValue: false,
    })
    isSubscription: boolean,

    @Args('spontaneousRate', { type: () => Float, nullable: true })
    spontaneousRate: number,
  ) {
    const parsedDate = parseDate(date || new Date().toISOString().split('T')[0]);

    const walletId = await this.walletService.findWalletId(usrId);

    let subscription = null;

    if (isSubscription)
      subscription = await this.subscriptionService.insert({
        amount: amount,
        dateStart: parsedDate,
        dateEnd: null,
        description: description,
        isActive: true,
        billingCycle: BillingCycleEnum.MONTHLY,
        nextBillingDate: this.subscriptionService.getNextBillingDate({
          billingCycle: BillingCycleEnum.MONTHLY,
          nextBillingDate: parsedDate,
        }),
        walletId: walletId.id,
      });

    const expense = await this.walletService.createExpense(
      usrId,
      amount,
      description,
      type,
      category,
      parsedDate,
      schedule,
      subscription ? subscription.id : null,
      spontaneousRate,
    );

    return expense;
  }

  @Mutation(() => ID)
  @InvalidateCache({ invalidateCurrentUser:true })
  async deleteExpense(@Args('id', { type: () => ID }) id: string, @User() userId: string) {
    await this.walletService.deleteExpense(id, userId);

    return id;
  }

  @Mutation(() => WalletEntity)
  @InvalidateCache({ invalidateCurrentUser:true })
  async editWalletBalance(@User() usrId: string, @Args('amount', { type: () => Int }) amount: number) {
    return await this.walletService.editUserWalletBalance(usrId, amount);
  }

  @Mutation(() => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser:true })
  async editExpense(
    @User() usrId: string,
    @Args('expenseId', { type: () => ID }) expenseId: string,
    @Args('amount', { type: () => Float }) amount: number,
    @Args('description') description: string,
    @Args('type', { type: () => String }) type: ExpenseType,
    @Args('category', { type: () => String }) category: string,
    @Args('date') date: string,
    @Args('spontaneousRate', { type: () => Float, nullable: true }) spontaneousRate: number,
  ) {
    const result = await this.walletService.editExpense(expenseId, usrId, {
      amount,
      description,
      type,
      category,
      date: new Date(date),
      spontaneousRate: spontaneousRate ?? 0,
    });

    return result;
  }

  @Query(() => Float)
  @UserCache(30)
  async getMonthTotalExpenses(@User() usrId: string) {
    return await this.walletService.getMonthTotalByType(
      'expense',
      usrId,
      new Date().getMonth(),
      new Date().getFullYear(),
    );
  }

  @Mutation(() => Boolean)
  @InvalidateCache({ invalidateCurrentUser:true })
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
  @UserCache(30)
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
  @UserCache(30)
  async getStatistics(@User() usrId: string, @Args('range', { type: () => [String, String] }) range: [string, string]) {
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
  @InvalidateCache({ invalidateCurrentUser:true })
  async refundExpense(@User() user: string, @Args('expenseId', { type: () => ID, nullable: false }) expenseId: string) {
    try {
      return this.walletService.refundExpense(user, expenseId);
    } catch (error) {
      throw new BadRequestException('Refund failed');
    }
  }

  @Mutation(() => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser:true })
  async createSubscription(
    @User() user: string,
    @Args('expenseId', { type: () => ID, nullable: false }) expenseId: string,
  ) {
    try {
      const wallet = await this.walletService.findWalletId(user);
      await this.subscriptionService.createSubscription(expenseId, wallet);

      return this.walletService.getExpense(expenseId);
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Subscription creation failed');
    }
  }

  @Mutation(() => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser:true })
  async cancelSubscription(@Args('subscriptionId', { type: () => ID }) subscriptionId: string) {
    try {
      await this.subscriptionService.cancelSubscription(subscriptionId);

      return this.subscriptionService.getExpenseBySubscriptionId(subscriptionId);
    } catch (error) {
      throw new BadRequestException('Subscription cancelation failed');
    }
  }

  @Mutation(() => ExpenseEntity)
  @InvalidateCache({ invalidateCurrentUser:true })
  async createExpenseFromImage(@Args('image') imageBase64: string, @User() user: string) {
    const prediction = await this.openAiService.extractReceiptContent(imageBase64);
    const receiptData = JSON.parse(prediction.choices[0].message.content) as {
      merchant: string;
      total_price: number;
      date: string;
      subexpenses: { name: string; quantity: number; amount: number; category: string }[];
      title: string;
      category: string;
    };

    const expense = await this.walletService.createExpenseFromAIPrediction(receiptData, user);

    const subexpenses = await this.expenseService.addMultipleSubExpenses(
      expense.id,
      receiptData.subexpenses.map((sub) => ({
        expenseId: expense.id,
        category: sub.category,
        description: sub.name + ' ' + sub.quantity + 'x',
        amount: sub.amount,
      })),
    );

    expense.subexpenses = subexpenses;

    return expense;
  }
}

import {
  Args,
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
} from 'src/entities/wallet.entity';
import { User } from 'src/utils/decorators/User';

@UseGuards(AuthGuard)
@Resolver(() => WalletEntity)
export class WalletResolver {
  constructor(private walletService: WalletService) {}

  @Query((returns) => WalletEntity)
  async wallet(@User() usrId: string) {
    return await this.walletService.getWalletByUserId(usrId);
  }

  @Mutation((returns) => WalletEntity)
  async createExpense(
    @User() usrId: string,
    @Args('amount', { type: () => Int }) amount: number,
    @Args('description') description: string,
    @Args('type', { type: () => String }) type: ExpenseType,
  ) {
    return await this.walletService.createExpense(
      usrId,
      amount,
      description,
      type,
    );
  }

  @Mutation(() => Boolean)
  async deleteExpense(
    @Args('id', { type: () => ID }) id: string,
    @User() userId: string,
  ) {
    return await this.walletService.deleteExpense(id, userId);
  }

  @Mutation(() => WalletEntity)
  async editWalletBalance(
    @User() usrId: string,
    @Args('amount', { type: () => Int }) amount: number,
  ) {
    return await this.walletService.editUserWalletBalance(usrId, amount);
  }
}

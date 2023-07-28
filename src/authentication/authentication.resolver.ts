import { BadRequestException, UseGuards } from '@nestjs/common';
import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UsersEntity } from './authentication.entity';
import {
  CreateAccountOutput,
  CreateAccountInput,
  LoginAccountInput,
} from './authentication.schemas';
import { AuthenticationService } from './authentication.service';
import { User } from 'src/utils/decorators/User';
import { AuthGuard } from 'src/utils/guards/AuthGuard';

@Resolver((of) => UsersEntity)
export class AuthenticationResolver {
  constructor(private authenticationService: AuthenticationService) {}

  @Query(() => String)
  hello() {
    return '';
  }

  @Mutation(() => CreateAccountOutput)
  async createAccount(
    @Args('account', { type: () => CreateAccountInput })
    accountInput: CreateAccountInput,
  ) {
    const doesAccountExist = await this.authenticationService.getAccountByEmail(
      accountInput.email,
    );

    if (doesAccountExist)
      throw new BadRequestException('Account already exists');

    const password = await this.authenticationService.hashPassword(
      accountInput.password,
    );

    const insertResult = await this.authenticationService.createAccount({
      ...accountInput,
      password,
    });

    const accountId = insertResult.identifiers[0].id;

    const token = this.authenticationService.generateToken(accountId);

    return {
      token,
      email: accountInput.email,
      message: 'Account created successfully',
      success: true,
      error: '',
      id: accountId,
    };
  }

  @Mutation(() => CreateAccountOutput)
  async loginAccount(
    @Args('account', { type: () => LoginAccountInput })
    accountInput: LoginAccountInput,
  ) {
    const findAccountByMethod = () =>
      !!accountInput.email && !!!accountInput.phone
        ? this.authenticationService.getAccountByEmail(accountInput.email)
        : this.authenticationService.getAccountByPhone(accountInput.phone);

    const existingAccount = await findAccountByMethod();

    if (!existingAccount)
      throw new BadRequestException('Account not found or invalid credentials');

    const isPasswordValid = await this.authenticationService.comparePasswords(
      accountInput.password,
      existingAccount.password,
    );

    if (!isPasswordValid)
      throw new BadRequestException('Invalid email or password');

    const token = this.authenticationService.generateToken(existingAccount.id);

    return {
      token,
      email: existingAccount.email,
      message: 'Account logged in successfully',
      success: true,
      error: '',
      id: existingAccount.id,
    };
  }

  @UseGuards(AuthGuard)
  @Mutation(() => String)
  async refreshToken(@User() usrId: string) {
    const token = this.authenticationService.generateToken(usrId);
    return token;
  }
}

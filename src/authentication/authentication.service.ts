import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersEntity } from 'src/entities/authentication.entity';
import { Repository } from 'typeorm';
import { CreateAccountInput } from './authentication.schemas';

import * as jwt from 'jsonwebtoken';

import * as bcrypt from 'bcrypt';

const JWT_SECRET_TEMP = 'mylife'; // temporary secret

@Injectable()
export class AuthenticationService {
  constructor(
    @InjectRepository(UsersEntity)
    private userRepository: Repository<UsersEntity>,
  ) {}

  createAccount(input: CreateAccountInput) {
    return this.userRepository.insert(input);
  }

  getAccountById(accountId: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: accountId })
      .getOne();
  }

  getAccountByEmail(email: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  getAccountByPhone(phone: number) {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.phone = :id', { phone })
      .getOne();
  }

  comparePasswords(password: string, hashedPassword: string) {
    return bcrypt.compare(password, hashedPassword);
  }

  generateToken(accountId: string): string {
    return jwt.sign({ accountId }, JWT_SECRET_TEMP, {
      expiresIn: '192h',
    });
  }

  verifyToken(token: string, cb: (err: any, dec: any) => void) {
    return jwt.verify(token, JWT_SECRET_TEMP, cb);
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}

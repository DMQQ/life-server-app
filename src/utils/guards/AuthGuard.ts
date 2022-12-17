import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'src/types';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = GqlExecutionContext.create(context).getContext()
      .req as Request;

    return typeof request?.account?.accountId !== 'undefined';
  }
}

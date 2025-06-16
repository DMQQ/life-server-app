import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const WalletId = createParamDecorator((_, ctx: ExecutionContext) => {
  const result = GqlExecutionContext.create(ctx).getContext().req.wallet?.walletId;

  return result;
});

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const User = createParamDecorator((_, ctx: ExecutionContext) => {
  const result =
    GqlExecutionContext.create(ctx).getContext().req.account?.accountId;

  return result;
});

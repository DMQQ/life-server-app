import { FieldMiddleware, MiddlewareContext, NextFn } from '@nestjs/graphql';
import * as dayjs from 'dayjs';

export const parseFieldToDate: FieldMiddleware = async (ctx: MiddlewareContext, next: NextFn) => {
  const value = await next();
  return dayjs(value).toDate();
};

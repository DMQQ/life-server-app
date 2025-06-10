import { SetMetadata, Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from './cache.service';
import { Reflector } from '@nestjs/core';

export const CACHE_KEY = 'cache';
export const INVALIDATE_CACHE_KEY = 'invalidate_cache';

export const UserCache = (ttl: number, options: { includeUser?: boolean } = {}) =>
  SetMetadata(CACHE_KEY, { ttl, options });

export const Cache = (ttl: number, options: { includeUser?: boolean } = {}) => SetMetadata(CACHE_KEY, { ttl, options });

export interface InvalidateOptions {
  patterns?: string[];
  invalidateAll?: boolean;
  invalidateCurrentUser?: boolean;
}

export const InvalidateCache = (options: InvalidateOptions = {}) => SetMetadata(INVALIDATE_CACHE_KEY, options);

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly cacheService: CacheService, private readonly reflector: Reflector) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const cacheMetadata = this.reflector.get(CACHE_KEY, context.getHandler());

    if (!cacheMetadata) {
      return next.handle();
    }

    const gqlCtx = GqlExecutionContext.create(context);
    const accountId = gqlCtx.getContext().req.account?.accountId;
    const gqlArgs = gqlCtx.getArgs();

    const className = context.getClass().name;
    const methodName = context.getHandler().name;
    const argsHash = Object.keys(gqlArgs).length > 0 ? JSON.stringify(gqlArgs) : '';
    const cacheKey = `${accountId}:${className}:${methodName}:${argsHash}`;

    try {
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult !== null) {
        return of(cachedResult);
      }

      return next.handle().pipe(
        tap(async (result) => {
          await this.cacheService.set(cacheKey, result, cacheMetadata.ttl);
        }),
      );
    } catch (error) {
      return next.handle();
    }
  }
}

@Injectable()
export class InvalidateCacheInterceptor implements NestInterceptor {
  constructor(private readonly cacheService: CacheService, private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const invalidateMetadata = this.reflector.get(INVALIDATE_CACHE_KEY, context.getHandler());

    if (!invalidateMetadata) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async () => {
        try {
          const gqlCtx = GqlExecutionContext.create(context);
          const accountId = gqlCtx.getContext().req.account?.accountId;

          if (invalidateMetadata.invalidateAll) {
            await this.cacheService.flushAll();
          } else if (invalidateMetadata.invalidateCurrentUser && accountId) {
            await this.cacheService.invalidateUser(accountId);
          } else if (invalidateMetadata.patterns) {
            for (const pattern of invalidateMetadata.patterns) {
              await this.cacheService.invalidatePattern(pattern);
            }
          }
        } catch (error) {}
      }),
    );
  }
}

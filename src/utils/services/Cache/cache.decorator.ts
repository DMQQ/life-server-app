import { SetMetadata, Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from './cache.service';
import { Reflector } from '@nestjs/core';

export const CACHE_KEY = 'cache';
export const INVALIDATE_CACHE_KEY = 'invalidate_cache';
export const DEFAULT_CACHE_MODULE_KEY = 'default_cache_module';

export interface CacheOptions {
  includeUser?: boolean;
  module?: string;
}

export interface DefaultCacheModuleOptions {
  invalidateCurrentUser?: boolean;
}

export const DefaultCacheModule = (module: string, options: DefaultCacheModuleOptions = {}) =>
  SetMetadata(DEFAULT_CACHE_MODULE_KEY, { module, ...options });

export const UserCache = (ttl: number, options: CacheOptions = {}) => SetMetadata(CACHE_KEY, { ttl, options });

export const Cache = (ttl: number, options: CacheOptions = {}) => SetMetadata(CACHE_KEY, { ttl, options });

export interface InvalidateOptions {
  patterns?: string[];
  invalidateAll?: boolean;
  invalidateCurrentUser?: boolean;
  module?: string;
}

export const InvalidateCache = (options: InvalidateOptions = {}) => SetMetadata(INVALIDATE_CACHE_KEY, options);

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const cacheMetadata = this.reflector.get(CACHE_KEY, context.getHandler());

    if (!cacheMetadata) {
      return next.handle();
    }

    const classDefaults = this.reflector.get(DEFAULT_CACHE_MODULE_KEY, context.getClass()) || {};
    const gqlCtx = GqlExecutionContext.create(context);
    const accountId = gqlCtx.getContext().req.account?.accountId;
    const gqlArgs = gqlCtx.getArgs();

    const className = context.getClass().name;
    const methodName = context.getHandler().name;
    const module = cacheMetadata.options?.module || classDefaults.module || className;
    const argsHash = Object.keys(gqlArgs).length > 0 ? JSON.stringify(gqlArgs) : '';
    const cacheKey = `${accountId}:${module}:${methodName}:${argsHash}`;

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
  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const invalidateMetadata = this.reflector.get(INVALIDATE_CACHE_KEY, context.getHandler());

    if (!invalidateMetadata) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async () => {
        try {
          const classDefaults = this.reflector.get(DEFAULT_CACHE_MODULE_KEY, context.getClass()) || {};
          const gqlCtx = GqlExecutionContext.create(context);
          const accountId = gqlCtx.getContext().req.account?.accountId;

          const shouldInvalidateCurrentUser =
            invalidateMetadata.invalidateCurrentUser ?? classDefaults.invalidateCurrentUser ?? false;
          const targetModule = invalidateMetadata.module || classDefaults.module;

          if (invalidateMetadata.invalidateAll) {
            await this.cacheService.flushAll();
          } else if (shouldInvalidateCurrentUser && accountId) {
            if (targetModule) {
              console.log('Invalidate pattern ', `${accountId}:${targetModule}:*`);
              await this.cacheService.invalidatePattern(`${accountId}:${targetModule}:*`);
            } else {
              await this.cacheService.invalidateUser(accountId);
            }
          } else if (targetModule && accountId) {
            await this.cacheService.invalidatePattern(`${accountId}:${targetModule}:*`);
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

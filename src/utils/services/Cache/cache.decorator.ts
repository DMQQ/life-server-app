import { Inject } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CacheService } from './cache.service';

export function Cache(ttl: number, options: { includeUser?: boolean } = {}) {
  const injectCacheService = Inject(CacheService);

  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    injectCacheService(target, 'cacheService');

    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheService: CacheService = this.cacheService;

      if (!cacheService) {
        return method.apply(this, args);
      }

      const className = this.constructor.name;
      const methodName = propertyName;

      let userId = '';
      if (options.includeUser) {
        // Try to get userId from method arguments
        const paramNames = getParameterNames(method);
        const userIdIndex = paramNames.findIndex(name =>
          ['userId', 'user', 'accountId', 'id'].includes(name)
        );

        if (userIdIndex !== -1 && args[userIdIndex]) {
          userId = args[userIdIndex];
        }
      }

      const argsHash = args.length > 0 ? JSON.stringify(args) : '';
      const cacheKey = userId
        ? `${className}:${methodName}:${userId}:${argsHash}`
        : `${className}:${methodName}:${argsHash}`;

      try {
        const cachedResult = await cacheService.get(cacheKey);
        if (cachedResult !== null) {
          return cachedResult;
        }

        const result = await method.apply(this, args);
        await cacheService.set(cacheKey, result, ttl);
        return result;
      } catch (error) {
        return method.apply(this, args);
      }
    };

    return descriptor;
  };
}

export function UserCache(ttl: number) {
  return Cache(ttl, { includeUser: true });
}

function getParameterNames(func: Function): string[] {
  const funcStr = func.toString();
  const result = funcStr.slice(funcStr.indexOf('(') + 1, funcStr.indexOf(')')).match(/([^\s,]+)/g);
  return result === null ? [] : result;
}

interface InvalidateOptions {
  methods?: string[];
  classes?: string[];
  patterns?: string[];
  userId?: string;
  userMethods?: string[];
  userClasses?: string[];
  invalidateAll?: boolean;
  invalidateCurrentUser?: boolean;
}

export function InvalidateCache(options: InvalidateOptions = {}) {
  const injectCacheService = Inject(CacheService);

  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    injectCacheService(target, 'cacheService');

    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);

      const cacheService: CacheService = this.cacheService;

      if (cacheService) {
        try {
          const className = this.constructor.name;

          let currentUserId = '';
          if (options.invalidateCurrentUser || options.userMethods || options.userClasses) {
            // Try to get userId from method arguments
            const paramNames = getParameterNames(method);
            const userIdIndex = paramNames.findIndex(name =>
              ['userId', 'user', 'accountId', 'id'].includes(name)
            );

            if (userIdIndex !== -1 && args[userIdIndex]) {
              currentUserId = args[userIdIndex];
            }
          }

          if (options.invalidateAll) {
            await cacheService.flushAll();
          } else {
            if (options.methods) {
              for (const methodName of options.methods) {
                await cacheService.invalidateMethod(className, methodName);
              }
            }

            if (options.classes) {
              for (const cls of options.classes) {
                await cacheService.invalidateClass(cls);
              }
            }

            if (options.patterns) {
              for (const pattern of options.patterns) {
                await cacheService.invalidatePattern(pattern);
              }
            }

            if (options.userId) {
              await cacheService.invalidateUser(options.userId);
            }

            if (options.userMethods && currentUserId) {
              for (const methodName of options.userMethods) {
                await cacheService.invalidateMethodForUser(className, methodName, currentUserId);
              }
            }

            if (options.userClasses && currentUserId) {
              for (const cls of options.userClasses) {
                await cacheService.invalidateClassForUser(cls, currentUserId);
              }
            }

            if (options.invalidateCurrentUser && currentUserId) {
              await cacheService.invalidateUser(currentUserId);
            }

            if (!options.methods && !options.classes && !options.patterns &&
              !options.userId && !options.userMethods && !options.userClasses &&
              !options.invalidateCurrentUser) {
              await cacheService.invalidateClass(className);
            }
          }
        } catch (error) {
          // Silent fail on cache invalidation
        }
      }

      return result;
    };

    return descriptor;
  };
}
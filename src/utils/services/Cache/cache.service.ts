import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger(CacheService.name);

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB) || 0,
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });
  }

  async onModuleInit() {
    try {
      await this.ping();
      this.logger.log('Redis ping successful');
    } catch (error) {
      this.logger.error('Redis ping failed:', error);
    }
  }

  async ping(): Promise<string> {
    return await this.redis.ping();
  }

  async getInfo(): Promise<any> {
    const info = await this.redis.info();
    return {
      raw: info,
      parsed: this.parseRedisInfo(info)
    };
  }

  async getStatus(): Promise<{
    connected: boolean;
    ping: string | null;
    memory: any;
    uptime: number | null;
  }> {
    try {
      const ping = await this.ping();
      const info = await this.getInfo();

      return {
        connected: true,
        ping,
        memory: info.parsed.memory,
        uptime: info.parsed.server?.uptime_in_seconds || null
      };
    } catch (error) {
      return {
        connected: false,
        ping: null,
        memory: null,
        uptime: null
      };
    }
  }

  private parseRedisInfo(info: string): any {
    const sections: any = {};
    let currentSection = 'general';

    info.split('\r\n').forEach(line => {
      if (line.startsWith('#')) {
        currentSection = line.substring(2).toLowerCase();
        sections[currentSection] = {};
      } else if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (!sections[currentSection]) sections[currentSection] = {};
        sections[currentSection][key] = isNaN(Number(value)) ? value : Number(value);
      }
    });

    return sections;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;

    return JSON.parse(value, this.dateReviver);
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    // TTL is in seconds for Redis setex
    await this.redis.setex(key, ttl, JSON.stringify(value, this.dateReplacer));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const keys = await this.redis.keys(pattern);
    if (keys.length === 0) return 0;
    return await this.redis.del(...keys);
  }

  async invalidateMethod(className: string, methodName: string): Promise<number> {
    const pattern = `${className}:${methodName}:*`;
    return await this.invalidatePattern(pattern);
  }

  async invalidateMethodForUser(className: string, methodName: string, userId: string): Promise<number> {
    const pattern = `${className}:${methodName}:${userId}:*`;
    return await this.invalidatePattern(pattern);
  }

  async invalidateClass(className: string): Promise<number> {
    const pattern = `${className}:*`;
    return await this.invalidatePattern(pattern);
  }

  async invalidateClassForUser(className: string, userId: string): Promise<number> {
    const pattern = `${className}:*:${userId}:*`;
    return await this.invalidatePattern(pattern);
  }

  async invalidateUser(userId: string): Promise<number> {
    const pattern = `*:*:${userId}:*`;
    return await this.invalidatePattern(pattern);
  }

  async flushAll(): Promise<void> {
    await this.redis.flushall();
  }

  private dateReplacer(key: string, value: any): any {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }

  private dateReviver(key: string, value: any): any {
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value);
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return new Date(value);
    }
    return value;
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { CacheService } from 'src/utils/services/Cache/cache.service';
import { Connection } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private connection: Connection,
    private redisService: CacheService,
  ) {}

  @Get()
  async check(): Promise<string> {
    const [dbStatus, redisStatus] = await Promise.allSettled([this.checkDatabase(), this.checkRedis()]);

    const dbOk = dbStatus.status === 'fulfilled';
    const redisOk = redisStatus.status === 'fulfilled';

    if (dbOk && redisOk) return 'ok';
    if (!dbOk && !redisOk) return 'down';
    return 'issues';
  }

  private async checkDatabase(): Promise<boolean> {
    await this.connection.query('SELECT 1');
    return true;
  }

  private async checkRedis(): Promise<boolean> {
    await this.redisService.ping();
    return true;
  }
}

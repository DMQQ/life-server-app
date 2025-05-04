import { Module } from '@nestjs/common';
import { HostsController } from './hosts.controller';

@Module({
  imports: [],
  controllers: [HostsController],
})
export class HostsModule {}

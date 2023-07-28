import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimelineFilesEntity } from 'src/timeline/timeline.entity';
import { UploadService } from './upload.service';
import { ExpenseFileEntity } from 'src/wallet/wallet.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TimelineFilesEntity, ExpenseFileEntity])],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}

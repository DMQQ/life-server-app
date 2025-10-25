import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimelineFilesEntity, TodoFilesEntity } from 'src/timeline/timeline.entity';
import { UploadService } from './upload.service';
import { ImageProcessingService } from './services/image-processing.service';
import { ExpenseFileEntity } from 'src/wallet/entities/wallet.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TimelineFilesEntity, ExpenseFileEntity, TodoFilesEntity])],
  controllers: [UploadController],
  providers: [UploadService, ImageProcessingService],
  exports: [UploadService, ImageProcessingService],
})
export class UploadModule {}

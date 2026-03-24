import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OccurrenceFileEntity } from 'src/timeline/entities/occurrence-file.entity';
import { TodoFilesEntity } from 'src/timeline/entities/occurrence-todo.entity';
import { UploadService } from './upload.service';
import { ImageProcessingService } from './services/image-processing.service';
import { ExpenseFileEntity } from 'src/wallet/entities/wallet.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OccurrenceFileEntity, ExpenseFileEntity, TodoFilesEntity])],
  controllers: [UploadController],
  providers: [UploadService, ImageProcessingService],
  exports: [UploadService, ImageProcessingService],
})
export class UploadModule {}

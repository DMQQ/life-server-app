import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TimelineFilesEntity, TodoFilesEntity } from 'src/timeline/timeline.entity';
import { In, Repository } from 'typeorm';
import { ExpenseFileEntity } from 'src/wallet/entities/wallet.entity';
import { FileFactory } from './factories/file.factory';
import { ImageProcessingService } from './services/image-processing.service';
import { FileUploadType, ProcessedFile, UploadOptions } from './types/upload.types';

@Injectable()
export class UploadService {
  constructor(
    @InjectRepository(TimelineFilesEntity)
    private timelineFilesRepository: Repository<TimelineFilesEntity>,

    @InjectRepository(ExpenseFileEntity)
    private expenseFilesRepository: Repository<ExpenseFileEntity>,

    @InjectRepository(TodoFilesEntity)
    private todoFilesRepository: Repository<TodoFilesEntity>,

    private imageProcessingService: ImageProcessingService,
  ) {}

  async uploadSingleFile(
    file: Express.Multer.File,
    entityId: string,
    type: FileUploadType,
    options: UploadOptions = {}
  ) {
    const processedFile = await this.processUploadedFile(file, options);
    
    switch (type) {
      case FileUploadType.EXPENSE:
        return this.insertExpenseFile(processedFile, entityId);
      case FileUploadType.TODO:
        return this.insertTodoFile(processedFile, entityId);
      case FileUploadType.TIMELINE:
        return this.insertTimelineFile(processedFile, entityId);
      default:
        throw new Error(`Unsupported file upload type: ${type}`);
    }
  }

  private async insertExpenseFile(file: ProcessedFile, expenseId: string) {
    const expenseFile = FileFactory.createExpenseFile({
      url: file.path,
      expenseId,
      name: file.name,
      type: file.type,
    });

    const result = await this.expenseFilesRepository.insert(expenseFile);
    return this.expenseFilesRepository.findOne({
      where: { id: result.identifiers[0].id },
    });
  }

  private async insertTodoFile(file: ProcessedFile, todoId: string) {
    const todoFile = FileFactory.createTodoFile({
      url: file.path,
      type: file.type,
      todoId,
    });

    const result = await this.todoFilesRepository.insert(todoFile);
    return this.todoFilesRepository.findOne({
      where: { id: result.identifiers[0].id },
    });
  }

  private async insertTimelineFile(file: ProcessedFile, timelineId: string) {
    const timelineFile = FileFactory.createTimelineFile({
      name: file.name,
      url: file.path,
      type: file.type,
      timelineId,
      isPublic: false,
    });

    const result = await this.timelineFilesRepository.insert(timelineFile);
    return this.timelineFilesRepository.findOne({
      where: { id: result.identifiers[0].id },
    });
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    entityId: string,
    type: FileUploadType,
    options: UploadOptions = {}
  ) {
    const processedFiles = await this.processMultipleUploadedFiles(files, options);
    
    switch (type) {
      case FileUploadType.TIMELINE:
        return this.insertMultipleTimelineFiles(processedFiles, entityId);
      case FileUploadType.EXPENSE:
        return this.insertMultipleExpenseFiles(processedFiles, entityId);
      default:
        throw new Error(`Bulk upload not supported for type: ${type}`);
    }
  }

  private async insertMultipleTimelineFiles(files: ProcessedFile[], timelineId: string) {
    const timelineFiles = FileFactory.createBulkTimelineFiles({
      files,
      timelineId,
      isPublic: false,
    });

    const results = await this.timelineFilesRepository.insert(timelineFiles);
    return this.timelineFilesRepository.find({
      where: { id: In(results.identifiers.map((i) => i.id)) },
    });
  }

  private async insertMultipleExpenseFiles(files: ProcessedFile[], expenseId: string) {
    const expenseFiles = FileFactory.createBulkExpenseFiles({
      files,
      expenseId,
    });

    const results = await this.expenseFilesRepository.insert(expenseFiles);
    return this.expenseFilesRepository.find({
      where: { id: In(results.identifiers.map((i) => i.id)) },
    });
  }

  async deleteFile(id: string, type: FileUploadType) {
    switch (type) {
      case FileUploadType.TIMELINE:
        return this.timelineFilesRepository.delete(id);
      case FileUploadType.EXPENSE:
        return this.expenseFilesRepository.delete(id);
      case FileUploadType.TODO:
        return this.todoFilesRepository.delete(id);
      default:
        throw new Error(`Unsupported file type for deletion: ${type}`);
    }
  }

  async getFile(id: string, type: FileUploadType) {
    switch (type) {
      case FileUploadType.TIMELINE:
        return this.timelineFilesRepository.findOne({ where: { id } });
      case FileUploadType.EXPENSE:
        return this.expenseFilesRepository.findOne({ where: { id } });
      case FileUploadType.TODO:
        return this.todoFilesRepository.findOne({ where: { id } });
      default:
        throw new Error(`Unsupported file type for retrieval: ${type}`);
    }
  }

  async saveBase64ToDisk(base64: string, expenseName: string, expenseId: string) {
    try {
      const result = await this.imageProcessingService.saveBase64Image(
        base64,
        expenseName,
        { quality: 60, maxHeight: 720 }
      );

      const processedFile: ProcessedFile = {
        name: expenseName + ' - AI Generated Image',
        path: result.processedPath.split('/').pop() || result.processedPath,
        size: result.size,
        type: 'image/jpeg',
        compressed: result.compressed,
      };

      return this.insertMultipleExpenseFiles([processedFile], expenseId);
    } catch (error) {
      console.log('Error saving base64 image:', error);
      return [];
    }
  }

  private async processUploadedFile(
    file: Express.Multer.File,
    options: UploadOptions
  ): Promise<ProcessedFile> {
    const result = await this.imageProcessingService.processImage(file.path, options);
    
    return FileFactory.createProcessedFile({
      originalFile: file,
      processedPath: result.processedPath,
      size: result.size,
      compressed: result.compressed,
      thumbnailPath: result.thumbnailPath,
      webpPath: result.webpPath,
    });
  }

  private async processMultipleUploadedFiles(
    files: Express.Multer.File[],
    options: UploadOptions
  ): Promise<ProcessedFile[]> {
    return Promise.all(
      files.map(file => this.processUploadedFile(file, options))
    );
  }
}

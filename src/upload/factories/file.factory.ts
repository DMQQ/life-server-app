import { ExpenseFileEntity } from 'src/wallet/entities/wallet.entity';
import { OccurrenceFileEntity } from 'src/timeline/entities/occurrence-file.entity';
import { TodoFilesEntity } from 'src/timeline/entities/occurrence-todo.entity';
import { ProcessedFile, FileTransformResult } from '../types/upload.types';

export class FileFactory {
  static createTimelineFile(data: {
    name: string;
    url: string;
    type: string;
    occurrenceId: string;
    isPublic?: boolean;
  }): OccurrenceFileEntity {
    const file = new OccurrenceFileEntity();
    file.name = data.name;
    file.url = data.url;
    file.type = data.type;
    file.occurrenceId = data.occurrenceId;
    file.isPublic = data.isPublic || false;
    return file;
  }

  static createExpenseFile(data: {
    url: string;
    expenseId: string;
    name?: string;
    type?: string;
  }): ExpenseFileEntity {
    const file = new ExpenseFileEntity();
    file.url = data.url;
    file.expenseId = data.expenseId as any;
    return file;
  }

  static createTodoFile(data: {
    url: string;
    type: string;
    todoId: string;
  }): TodoFilesEntity {
    const file = new TodoFilesEntity();
    file.url = data.url;
    file.type = data.type;
    file.todoId = data.todoId;
    return file;
  }

  static createBulkTimelineFiles(data: {
    files: ProcessedFile[];
    occurrenceId: string;
    isPublic?: boolean;
  }): OccurrenceFileEntity[] {
    return data.files.map((file) =>
      this.createTimelineFile({
        name: file.name,
        url: file.path,
        type: file.type,
        occurrenceId: data.occurrenceId,
        isPublic: data.isPublic,
      }),
    );
  }

  static createBulkExpenseFiles(data: {
    files: ProcessedFile[];
    expenseId: string;
  }): ExpenseFileEntity[] {
    return data.files.map((file) =>
      this.createExpenseFile({
        url: file.path,
        expenseId: data.expenseId,
        name: file.name,
        type: file.type,
      }),
    );
  }

  static transformUploadedFile(file: Express.Multer.File): FileTransformResult {
    return {
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      path: file.path.includes('\\') ? file.path.split('\\').pop() : file.path.split('/').pop(),
    };
  }

  static transformUploadedFiles(files: Express.Multer.File[]): FileTransformResult[] {
    return files.map((file) => this.transformUploadedFile(file));
  }

  static createProcessedFile(data: {
    originalFile: Express.Multer.File;
    processedPath: string;
    size: number;
    compressed?: boolean;
    thumbnailPath?: string;
    webpPath?: string;
  }): ProcessedFile {
    return {
      name: data.originalFile.originalname,
      size: data.size,
      type: data.originalFile.mimetype,
      path: data.processedPath.includes('\\')
        ? data.processedPath.split('\\').pop()
        : data.processedPath.split('/').pop(),
      originalPath: data.originalFile.path,
      compressed: data.compressed || false,
      thumbnailPath: data.thumbnailPath,
      webpPath: data.webpPath,
    };
  }
}

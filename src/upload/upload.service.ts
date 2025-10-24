import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TimelineFilesEntity, TodoFilesEntity } from 'src/timeline/timeline.entity';
import { In, Repository } from 'typeorm';
import { File } from './upload.controller';
import { ExpenseFileEntity } from 'src/wallet/entities/wallet.entity';
import * as sharp from 'sharp';
import * as path from 'path';
import { writeFile } from 'fs/promises';
import { createHash } from 'crypto';

@Injectable()
export class UploadService {
  constructor(
    @InjectRepository(TimelineFilesEntity)
    private timelineFilesRepository: Repository<TimelineFilesEntity>,

    @InjectRepository(ExpenseFileEntity)
    private expenseFilesRepository: Repository<ExpenseFileEntity>,

    @InjectRepository(TodoFilesEntity)
    private todoFilesRepository: Repository<TodoFilesEntity>,
  ) {}

  async insertExpenseFile(file: File, expenseId: string) {
    const result = await this.expenseFilesRepository.insert({
      url: file.path,
      expenseId: expenseId as any,
    });

    return this.expenseFilesRepository.findOne({
      where: { id: result.identifiers[0].id },
    });
  }

  async uploadTodoFile(file: File, todoId: string) {
    const result = await this.todoFilesRepository.insert({
      todoId,
      type: file.type,
      url: file.path,
    });

    return this.todoFilesRepository.findOne({
      where: { id: result.identifiers[0].id },
    });
  }

  async uploadFiles(file: File[], timelineId: any) {
    const results = await this.timelineFilesRepository.insert(
      file.map((f) => ({
        name: f.name,
        isPublic: false,
        url: f.path,
        type: f.type,
        timelineId,
      })),
    );

    return this.timelineFilesRepository.find({
      where: { id: In(results.identifiers.map((i) => i.id)) },
    });
  }

  async uploadExpenseFiles(file: File[], expenseId: any) {
    const results = await this.expenseFilesRepository.insert(
      file.map((f) => ({
        name: f.name,
        url: f.path,
        type: f.type,
        expenseId,
      })),
    );

    return this.expenseFilesRepository.find({
      where: { id: In(results.identifiers.map((i) => i.id)) },
    });
  }

  async deleteFile(id: string) {
    const result = await this.timelineFilesRepository.delete(id);

    return result;
  }

  async getFile(id: string) {
    const result = await this.timelineFilesRepository.findOne({
      where: { id },
    });

    return result;
  }

  async saveBase64ToDisk(base64: string, expenseName: string, expenseId: string) {
    const uri = base64.split(';base64,').pop();

    try {
      const image = await sharp(Buffer.from(uri, 'base64')).resize({ height: 720 }).jpeg({ quality: 60 }).toBuffer();

      const fileName = createHash('md5')
        .update(expenseName + Date.now())
        .digest('hex');

      const filePath = path.join(process.cwd(), 'uploads', fileName);

      await writeFile(filePath, image);

      const files = await this.uploadExpenseFiles(
        [
          {
            name: expenseName + '- AI Generated Image',
            path: fileName,
            size: image.byteLength,
            type: 'expense',
          },
        ],
        expenseId,
      );

      return files;
    } catch (error) {
      console.log('err', error);
      return [];
    }
  }
}

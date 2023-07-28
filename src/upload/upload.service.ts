import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TimelineFilesEntity } from 'src/timeline/timeline.entity';
import { In, Repository } from 'typeorm';
import { File } from './upload.controller';

@Injectable()
export class UploadService {
  constructor(
    @InjectRepository(TimelineFilesEntity)
    private timelineFilesRepository: Repository<TimelineFilesEntity>,
  ) {}

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
}

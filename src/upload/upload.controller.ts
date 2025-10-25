import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  Query,
  Res,
  Get,
  Param,
  HttpStatus,
  Delete,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { createReadStream } from 'fs';
import { join } from 'path';
import { unlink } from 'fs';
import { Response } from 'express';
import * as path from 'path';
import { diskStorage } from 'multer';
import { FileUploadType, UploadOptions } from './types/upload.types';

const storage = diskStorage({
  destination: './uploads',
  filename: (req, file, callback) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    callback(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  },
});

const imageFileFilter = (req, file, callback) => {
  if (file.mimetype.startsWith('image/')) {
    callback(null, true);
  } else {
    callback(null, true);
  }
};

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Delete(':type/:id')
  async deleteFile(@Param('id') id: string, @Param('type') type: string) {
    const fileType = this.parseFileType(type);
    const file = await this.uploadService.getFile(id, fileType);

    if (file) {
      const filePath = join(process.cwd(), `./uploads/${file.url}`);
      unlink(filePath, (err) => {
        if (err) {
          console.error('Error deleting file:', err);
        }
      });
    }

    return this.uploadService.deleteFile(id, fileType);
  }

  @Post('/single')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: storage,
      fileFilter: imageFileFilter,
    }),
  )
  async uploadSingleFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type: string,
    @Query('entityId') entityId: string,
    @Query('compress') compress?: string,
    @Query('generateThumbnail') generateThumbnail?: string,
    @Query('convertToWebP') convertToWebP?: string,
    @Query('quality') quality?: string,
  ) {
    this.validateUploadRequest(file, entityId, type);

    const uploadOptions = this.parseUploadOptions({
      compress,
      generateThumbnail,
      convertToWebP,
      quality,
    });

    const fileType = this.parseFileType(type);

    try {
      return await this.uploadService.uploadSingleFile(file, entityId, fileType, uploadOptions);
    } catch (error) {
      console.error('Upload error:', error);
      throw new BadRequestException('Error uploading file');
    }
  }

  @Post('/multiple')
  @UseInterceptors(
    FilesInterceptor('file', 10, {
      storage: storage,
      fileFilter: imageFileFilter,
    }),
  )
  async uploadMultipleFiles(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Query('type') type: string,
    @Query('entityId') entityId: string,
    @Query('compress') compress?: string,
    @Query('generateThumbnail') generateThumbnail?: string,
    @Query('convertToWebP') convertToWebP?: string,
    @Query('quality') quality?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    if (!entityId || !type) {
      throw new BadRequestException('Entity ID and type are required');
    }

    const uploadOptions = this.parseUploadOptions({
      compress,
      generateThumbnail,
      convertToWebP,
      quality,
    });

    const fileType = this.parseFileType(type);

    try {
      return await this.uploadService.uploadMultipleFiles(files, entityId, fileType, uploadOptions);
    } catch (error) {
      console.error('Multiple upload error:', error);
      throw new BadRequestException('Error uploading files');
    }
  }

  @Get('images/:img')
  getUploadedFile(@Param('img') img: string, @Res() res: Response) {
    if (typeof img === 'undefined') return res.status(HttpStatus.NOT_ACCEPTABLE);
    const file = createReadStream(join(process.cwd(), `./uploads/${img}`)).on('error', (err) => {
      res.status(404).send({
        error: 'Image not found',
        statusCode: 404,
        message: ['Image not found'],
      });
    });

    return file.pipe(res);
  }

  private validateUploadRequest(file: Express.Multer.File, entityId: string, type: string): void {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!entityId) {
      throw new BadRequestException('Entity ID is required');
    }

    if (!type) {
      throw new BadRequestException('Upload type is required');
    }
  }

  private parseFileType(type: string): FileUploadType {
    const lowerType = type.toLowerCase();
    if (Object.values(FileUploadType).includes(lowerType as FileUploadType)) {
      return lowerType as FileUploadType;
    }
    throw new BadRequestException(`Invalid file type: ${type}`);
  }

  private parseUploadOptions(queryParams: {
    compress?: string;
    generateThumbnail?: string;
    convertToWebP?: string;
    quality?: string;
  }): UploadOptions {
    return {
      compress: queryParams.compress === 'true',
      generateThumbnail: queryParams.generateThumbnail === 'true',
      convertToWebP: queryParams.convertToWebP === 'true',
      quality: queryParams.quality ? parseInt(queryParams.quality, 10) : 80,
      maxWidth: 1920,
      maxHeight: 1080,
    };
  }
}

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
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { createReadStream, unlinkSync } from 'fs';
import { join } from 'path';

import { unlink } from 'fs';

import { Response } from 'express';

export interface File {
  name: string;
  size: number;
  type: string;
  path: string;
}

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    const file = await this.uploadService.getFile(id);

    if (file) {
      // Delete file from server
      const path = join(process.cwd(), `./uploads/${file.url}`);

      unlink(path, (err) => {
        if (err) {
          console.error(err);
          return;
        }
      });
    }

    const result = await this.uploadService.deleteFile(id);

    return result;
  }

  @Post('/')
  @UseInterceptors(
    FilesInterceptor('file', 10, {
      dest: './uploads',
    }),
  )
  async uploadFile(
    @UploadedFiles() file: Array<Express.Multer.File>,
    @Query('type') type: string,
    @Query('timelineId') timelineId: string,
    @Res() response: Response,
  ) {
    if (typeof file === 'undefined' || file.length === 0)
      return response.status(400).send({
        error: 'No file uploaded',
        statusCode: 400,
      });

    const transformedFiles = file.map((file) => ({
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      path: file.path.includes('\\')
        ? file.path.split('\\')[1]
        : file.path.split('/')[1],
    }));

    if (type === 'timeline') {
      try {
        const result = await this.uploadService.uploadFiles(
          transformedFiles,
          timelineId,
        );

        return response.send(result);
      } catch (error) {
        console.log(error);

        response.status(400).send({
          error: 'Error uploading file',
        });
      }
    }
  }

  @Get('images/:img')
  getUploadedFile(@Param('img') img: string, @Res() res: Response) {
    if (typeof img === 'undefined')
      return res.status(HttpStatus.NOT_ACCEPTABLE);
    const file = createReadStream(join(process.cwd(), `./uploads/${img}`)).on(
      'error',
      (err) => {
        res.status(404).send({
          error: 'Image not found',
          statusCode: 404,
          message: ['Image not found'],
        });
      },
    );

    return file.pipe(res);
  }
}

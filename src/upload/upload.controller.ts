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
  Body,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { createReadStream, unlinkSync, writeFile } from 'fs';
import { join } from 'path';
import { unlink } from 'fs';
import { Response } from 'express';
import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as multer from 'multer';
import { diskStorage } from 'multer';

export interface File {
  name: string;
  size: number;
  type: string;
  path: string;
}

// Configure multer storage with compression options
const storage = diskStorage({
  destination: './uploads',
  filename: (req, file, callback) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    callback(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  },
});

// Filter for processing only images
const imageFileFilter = (req, file, callback) => {
  if (file.mimetype.startsWith('image/')) {
    callback(null, true);
  } else {
    callback(null, true); // Still accept non-image files, but they won't be compressed
  }
};

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

  @Post('/expense-file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: storage,
      fileFilter: imageFileFilter,
    }),
  )
  async uploadSingleExpenseFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('expenseId') expenseId: string,
    @Query('compress') compress: string,
    @Res() response: Response,
  ) {
    if (!file) {
      return response.status(400).send({
        error: 'No file uploaded',
        statusCode: 400,
      });
    }

    if (!expenseId) {
      return response.status(400).send({
        error: 'Expense ID is required',
        statusCode: 400,
      });
    }

    try {
      let processedFile = file;

      if (compress === 'true' && file.mimetype.startsWith('image/')) {
        const compressedFilePath = await this.compressToFHD(file.path);

        const stats = await fs.stat(compressedFilePath);
        processedFile = {
          ...file,
          size: stats.size,
          path: compressedFilePath,
        };
      }

      const transformedFile = {
        name: file.originalname,
        size: processedFile.size,
        type: file.mimetype,
        path: processedFile.path.includes('\\')
          ? processedFile.path.split('\\')[1]
          : processedFile.path.split('/')[1],
      };

      const result = await this.uploadService.insertExpenseFile(
        transformedFile,
        expenseId,
      );

      return response.send(result);
    } catch (error) {
      console.log(error);

      return response.status(400).send({
        error: 'Error uploading file',
        statusCode: 400,
      });
    }
  }

  @Post('/')
  @UseInterceptors(
    FilesInterceptor('file', 10, {
      storage: storage,
      fileFilter: imageFileFilter,
    }),
  )
  async uploadFile(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Query('type') type: string,
    @Query('timelineId') timelineId: string,
    @Query('expenseId') expenseId: string,
    @Query('compress') compress: string,
    @Res() response: Response,
  ) {
    if (typeof files === 'undefined' || files.length === 0)
      return response.status(400).send({
        error: 'No file uploaded',
        statusCode: 400,
      });

    try {
      // Process and possibly compress files
      const processedFiles = await Promise.all(
        files.map(async (file) => {
          if (compress === 'true' && file.mimetype.startsWith('image/')) {
            const compressedFilePath = await this.compressToFHD(file.path);
            const stats = await fs.stat(compressedFilePath);

            return {
              originalname: file.originalname,
              size: stats.size,
              mimetype: file.mimetype,
              path: compressedFilePath,
            };
          }
          return file;
        }),
      );

      const transformedFiles = processedFiles.map((file) => ({
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        path: file.path.includes('\\')
          ? file.path.split('\\')[1]
          : file.path.split('/')[1],
      }));

      if (type === 'timeline') {
        const result = await this.uploadService.uploadFiles(
          transformedFiles,
          timelineId,
        );

        return response.send(result);
      } else if (type === 'expense') {
        const result = await this.uploadService.uploadExpenseFiles(
          transformedFiles,
          expenseId,
        );

        return response.send(result);
      }
    } catch (error) {
      console.log(error);

      response.status(400).send({
        error: 'Error uploading file',
      });
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

  /**
   * Compresses an image to FHD quality (1920x1080)
   * @param filePath Path to the original file
   * @returns Path to the compressed file
   */
  private async compressToFHD(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    if (!['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      return filePath;
    }

    try {
      const outputFile = filePath.replace(ext, `-compressed${ext}`);

      await sharp(filePath)
        .resize({
          width: 1920,
          height: 1080,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toFile(outputFile);

      await fs.unlink(filePath);
      await fs.rename(outputFile, filePath);

      return filePath;
    } catch (error) {
      return filePath;
    }
  }
}

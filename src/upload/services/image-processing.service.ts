import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createHash } from 'crypto';
import { UploadOptions, ImageProcessingResult } from '../types/upload.types';

@Injectable()
export class ImageProcessingService {
  private readonly supportedImageTypes = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.bmp'];
  
  async processImage(
    filePath: string,
    options: UploadOptions = {}
  ): Promise<ImageProcessingResult> {
    const ext = path.extname(filePath).toLowerCase();
    
    if (!this.isImageFile(ext)) {
      return {
        originalPath: filePath,
        processedPath: filePath,
        size: (await fs.stat(filePath)).size,
        compressed: false,
      };
    }

    try {
      const processedPath = await this.optimizeImage(filePath, options);
      const thumbnailPath = options.generateThumbnail 
        ? await this.generateThumbnail(processedPath)
        : undefined;
      const webpPath = options.convertToWebP 
        ? await this.convertToWebP(processedPath)
        : undefined;

      const stats = await fs.stat(processedPath);
      
      // Clean up original if it was processed
      if (processedPath !== filePath) {
        await fs.unlink(filePath);
      }

      return {
        originalPath: filePath,
        processedPath,
        thumbnailPath,
        webpPath,
        size: stats.size,
        compressed: true,
      };
    } catch (error) {
      console.error('Image processing failed:', error);
      return {
        originalPath: filePath,
        processedPath: filePath,
        size: (await fs.stat(filePath)).size,
        compressed: false,
      };
    }
  }

  async processMultipleImages(
    filePaths: string[],
    options: UploadOptions = {}
  ): Promise<ImageProcessingResult[]> {
    return Promise.all(
      filePaths.map(filePath => this.processImage(filePath, options))
    );
  }

  private async optimizeImage(
    filePath: string,
    options: UploadOptions
  ): Promise<string> {
    const {
      quality = 80,
      maxWidth = 1920,
      maxHeight = 1080,
      compress = true
    } = options;

    if (!compress) {
      return filePath;
    }

    const outputPath = this.generateProcessedPath(filePath, 'optimized');
    
    const pipeline = sharp(filePath)
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ 
        quality,
        progressive: true,
        mozjpeg: true
      })
      .withMetadata({}); // Remove EXIF data for privacy and size

    await pipeline.toFile(outputPath);
    
    // Replace original with optimized version
    await fs.rename(outputPath, filePath);
    return filePath;
  }

  private async generateThumbnail(filePath: string): Promise<string> {
    const thumbnailPath = this.generateProcessedPath(filePath, 'thumb');
    
    await sharp(filePath)
      .resize({
        width: 300,
        height: 300,
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 70 })
      .toFile(thumbnailPath);

    return thumbnailPath;
  }

  private async convertToWebP(filePath: string): Promise<string> {
    const webpPath = this.generateProcessedPath(filePath, 'webp', '.webp');
    
    await sharp(filePath)
      .webp({ 
        quality: 80,
        effort: 6 // Higher effort for better compression
      })
      .toFile(webpPath);

    return webpPath;
  }

  async saveBase64Image(
    base64Data: string,
    fileName: string,
    options: UploadOptions = {}
  ): Promise<ImageProcessingResult> {
    const imageBuffer = Buffer.from(base64Data.split(';base64,').pop(), 'base64');
    
    const hash = createHash('md5')
      .update(fileName + Date.now())
      .digest('hex');

    const filePath = path.join(process.cwd(), 'uploads', `${hash}.jpg`);
    
    // Process and save the image
    const processedBuffer = await sharp(imageBuffer)
      .resize({ 
        height: options.maxHeight || 720,
        width: options.maxWidth || 1280,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ 
        quality: options.quality || 60,
        progressive: true
      })
      .toBuffer();

    await fs.writeFile(filePath, processedBuffer);

    return {
      originalPath: filePath,
      processedPath: filePath,
      size: processedBuffer.length,
      compressed: true,
    };
  }

  private isImageFile(extension: string): boolean {
    return this.supportedImageTypes.includes(extension);
  }

  private generateProcessedPath(
    originalPath: string,
    suffix: string,
    newExtension?: string
  ): string {
    const ext = newExtension || path.extname(originalPath);
    const baseName = path.basename(originalPath, path.extname(originalPath));
    const dirName = path.dirname(originalPath);
    
    return path.join(dirName, `${baseName}-${suffix}${ext}`);
  }

  async getImageMetadata(filePath: string) {
    try {
      return await sharp(filePath).metadata();
    } catch (error) {
      return null;
    }
  }

  async validateImageFile(filePath: string): Promise<boolean> {
    try {
      const metadata = await this.getImageMetadata(filePath);
      return metadata !== null;
    } catch {
      return false;
    }
  }
}
export enum FileUploadType {
  TIMELINE = 'timeline',
  EXPENSE = 'expense',
  TODO = 'todo',
}

export interface ProcessedFile {
  name: string;
  size: number;
  type: string;
  path: string;
  originalPath?: string;
  compressed?: boolean;
  thumbnailPath?: string;
  webpPath?: string;
}

export interface UploadOptions {
  compress?: boolean;
  generateThumbnail?: boolean;
  convertToWebP?: boolean;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface ImageProcessingResult {
  originalPath: string;
  processedPath: string;
  thumbnailPath?: string;
  webpPath?: string;
  size: number;
  compressed: boolean;
}

export interface FileTransformResult {
  name: string;
  size: number;
  type: string;
  path: string;
}
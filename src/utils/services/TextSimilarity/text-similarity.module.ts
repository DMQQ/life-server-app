import { Module } from '@nestjs/common';
import { TextSimilarityService } from './text-similarity.service';

@Module({
  imports: [],
  providers: [TextSimilarityService],
  exports: [TextSimilarityService],
})
export class TextSimilarityModule {}

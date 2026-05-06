import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MinioService } from './minio.service';
import { QdrantService } from './qdrant.service';
import { TextExtractorService } from './text-extractor.service';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [HttpModule, AuthModule, LlmModule],
  controllers: [FilesController],
  providers: [FilesService, MinioService, QdrantService, TextExtractorService],
  exports: [QdrantService, FilesService],
})
export class FilesModule {}

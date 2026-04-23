import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MinioService } from './minio.service';
import { QdrantService } from './qdrant.service';
import { TextExtractorService } from './text-extractor.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [HttpModule, AuthModule],
  controllers: [FilesController],
  providers: [FilesService, MinioService, QdrantService, TextExtractorService],
  exports: [QdrantService],
})
export class FilesModule {}

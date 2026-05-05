import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MemoryService } from './memory.service';
import { MemoryRepository } from './memory.repository';
import { VectorMemoryService } from './vector-memory.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [HttpModule, ConfigModule, PrismaModule],
  providers: [MemoryService, MemoryRepository, VectorMemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}

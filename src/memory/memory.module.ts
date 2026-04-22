import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryRepository } from './memory.repository';

@Module({
  providers: [MemoryService, MemoryRepository],
  exports: [MemoryService],
})
export class MemoryModule {}

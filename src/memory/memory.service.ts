import { Injectable } from '@nestjs/common';
import { VectorMemoryService, MemoryResult } from './vector-memory.service';

@Injectable()
export class MemoryService {
  constructor(private readonly vectorMemory: VectorMemoryService) {}

  remember(userId: string, key: string, value: string) {
    return this.vectorMemory.remember(userId, key, value);
  }

  recall(userId: string, query: string): Promise<MemoryResult[]> {
    return this.vectorMemory.recall(userId, query);
  }

  list(userId: string) {
    return this.vectorMemory.list(userId);
  }

  forget(userId: string, key: string) {
    return this.vectorMemory.forget(userId, key);
  }
}

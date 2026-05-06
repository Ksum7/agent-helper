import { Injectable } from '@nestjs/common';
import { VectorMemoryService, MemoryResult, MemoryType } from './vector-memory.service';

export { MemoryType };

@Injectable()
export class MemoryService {
  constructor(private readonly vectorMemory: VectorMemoryService) {}

  remember(userId: string, key: string, value: string, type: MemoryType = MemoryType.FACT) {
    return this.vectorMemory.remember(userId, key, value, type);
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

import { Injectable } from '@nestjs/common';
import { MemoryRepository } from './memory.repository';

@Injectable()
export class MemoryService {
  constructor(private readonly repo: MemoryRepository) {}

  remember(userId: string, key: string, value: string) {
    return this.repo.set(userId, key, value);
  }

  recall(userId: string, query: string) {
    return this.repo.search(userId, query);
  }

  list(userId: string) {
    return this.repo.list(userId);
  }

  forget(userId: string, key: string) {
    return this.repo.delete(userId, key);
  }
}

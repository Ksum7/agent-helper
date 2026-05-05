import { Test, TestingModule } from '@nestjs/testing';
import { MemoryService } from './memory.service';
import { VectorMemoryService } from './vector-memory.service';

describe('MemoryService', () => {
  let service: MemoryService;
  let vectorMemory: jest.Mocked<VectorMemoryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        {
          provide: VectorMemoryService,
          useValue: {
            remember: jest.fn(),
            recall: jest.fn(),
            list: jest.fn(),
            forget: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(MemoryService);
    vectorMemory = module.get(VectorMemoryService) as jest.Mocked<VectorMemoryService>;
  });

  describe('remember', () => {
    it('delegates to vectorMemory.remember', async () => {
      vectorMemory.remember.mockResolvedValue(undefined);

      await service.remember('user-1', 'name', 'John');

      expect(vectorMemory.remember).toHaveBeenCalledWith('user-1', 'name', 'John');
    });
  });

  describe('recall', () => {
    it('delegates to vectorMemory.recall', async () => {
      const results = [{ id: '1', key: 'name', value: 'John', score: 0.95 }];
      vectorMemory.recall.mockResolvedValue(results as any);

      const result = await service.recall('user-1', 'john');

      expect(vectorMemory.recall).toHaveBeenCalledWith('user-1', 'john');
      expect(result).toEqual(results);
    });
  });

  describe('list', () => {
    it('delegates to vectorMemory.list', async () => {
      const items = [
        { id: '1', key: 'name', value: 'John' },
        { id: '2', key: 'age', value: '30' },
      ];
      vectorMemory.list.mockResolvedValue(items as any);

      const result = await service.list('user-1');

      expect(vectorMemory.list).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(items);
    });
  });

  describe('forget', () => {
    it('delegates to vectorMemory.forget', async () => {
      vectorMemory.forget.mockResolvedValue(undefined);

      await service.forget('user-1', 'name');

      expect(vectorMemory.forget).toHaveBeenCalledWith('user-1', 'name');
    });
  });
});

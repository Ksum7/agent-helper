import { Test, TestingModule } from '@nestjs/testing';
import { MemoryService } from './memory.service';
import { MemoryRepository } from './memory.repository';

describe('MemoryService', () => {
  let service: MemoryService;
  let repo: jest.Mocked<MemoryRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        {
          provide: MemoryRepository,
          useValue: {
            set: jest.fn(),
            search: jest.fn(),
            list: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(MemoryService);
    repo = module.get(MemoryRepository);
  });

  describe('remember', () => {
    it('delegates to repo.set', async () => {
      repo.set.mockResolvedValue({ id: '1', userId: 'user-1', key: 'name', value: 'John' } as any);

      const result = await service.remember('user-1', 'name', 'John');

      expect(repo.set).toHaveBeenCalledWith('user-1', 'name', 'John');
      expect(result).toEqual({ id: '1', userId: 'user-1', key: 'name', value: 'John' });
    });
  });

  describe('recall', () => {
    it('delegates to repo.search', async () => {
      const results = [{ id: '1', key: 'name', value: 'John' }];
      repo.search.mockResolvedValue(results as any);

      const result = await service.recall('user-1', 'john');

      expect(repo.search).toHaveBeenCalledWith('user-1', 'john');
      expect(result).toEqual(results);
    });
  });

  describe('list', () => {
    it('delegates to repo.list', async () => {
      const items = [
        { id: '1', key: 'name', value: 'John' },
        { id: '2', key: 'age', value: '30' },
      ];
      repo.list.mockResolvedValue(items as any);

      const result = await service.list('user-1');

      expect(repo.list).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(items);
    });
  });

  describe('forget', () => {
    it('delegates to repo.delete', async () => {
      repo.delete.mockResolvedValue({} as any);

      await service.forget('user-1', 'name');

      expect(repo.delete).toHaveBeenCalledWith('user-1', 'name');
    });
  });
});

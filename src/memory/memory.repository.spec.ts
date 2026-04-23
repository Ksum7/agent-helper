import { Test, TestingModule } from '@nestjs/testing';
import { MemoryRepository } from './memory.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('MemoryRepository', () => {
  let repo: MemoryRepository;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      memory: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repo = module.get(MemoryRepository);
  });

  describe('set', () => {
    it('upserts memory with correct where, create, and update payload', async () => {
      const memory = {
        id: '1',
        userId: 'user-1',
        key: 'name',
        value: 'John',
        createdAt: new Date(),
      };
      prisma.memory.upsert.mockResolvedValue(memory);

      const result = await repo.set('user-1', 'name', 'John');

      expect(prisma.memory.upsert).toHaveBeenCalledWith({
        where: { userId_key: { userId: 'user-1', key: 'name' } },
        create: { userId: 'user-1', key: 'name', value: 'John' },
        update: { value: 'John' },
      });
      expect(result).toEqual(memory);
    });
  });

  describe('get', () => {
    it('finds memory by userId and key', async () => {
      const memory = {
        id: '1',
        userId: 'user-1',
        key: 'name',
        value: 'John',
      };
      prisma.memory.findUnique.mockResolvedValue(memory);

      const result = await repo.get('user-1', 'name');

      expect(prisma.memory.findUnique).toHaveBeenCalledWith({
        where: { userId_key: { userId: 'user-1', key: 'name' } },
      });
      expect(result).toEqual(memory);
    });
  });

  describe('search', () => {
    it('searches memory by userId with OR conditions on key and value', async () => {
      const results = [
        { id: '1', key: 'name', value: 'John' },
        { id: '2', key: 'location', value: 'New York' },
      ];
      prisma.memory.findMany.mockResolvedValue(results);

      const result = await repo.search('user-1', 'john');

      expect(prisma.memory.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          OR: [
            { key: { contains: 'john', mode: 'insensitive' } },
            { value: { contains: 'john', mode: 'insensitive' } },
          ],
        },
        take: 10,
      });
      expect(result).toEqual(results);
    });
  });

  describe('list', () => {
    it('lists all memories for user ordered by createdAt desc', async () => {
      const items = [
        { id: '1', key: 'name', value: 'John', createdAt: new Date('2025-01-02') },
        { id: '2', key: 'age', value: '30', createdAt: new Date('2025-01-01') },
      ];
      prisma.memory.findMany.mockResolvedValue(items);

      const result = await repo.list('user-1');

      expect(prisma.memory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(items);
    });
  });

  describe('delete', () => {
    it('deletes memory by userId and key', async () => {
      const deleted = { id: '1', key: 'name' };
      prisma.memory.delete.mockResolvedValue(deleted);

      const result = await repo.delete('user-1', 'name');

      expect(prisma.memory.delete).toHaveBeenCalledWith({
        where: { userId_key: { userId: 'user-1', key: 'name' } },
      });
      expect(result).toEqual(deleted);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { VectorMemoryService } from './vector-memory.service';
import { PrismaService } from '../prisma/prisma.service';
import { of } from 'rxjs';

describe('VectorMemoryService', () => {
  let service: VectorMemoryService;
  let prisma: PrismaService;

  const mockConfig = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        QDRANT_URL: 'http://localhost:6333',
        EMBED_URL: 'http://localhost:8000',
        EMBED_MODEL: 'intfloat/e5-small-v2',
        RERANK_URL: 'http://localhost:8000',
        RERANK_MODEL: 'BAAI/bge-reranker-v2-m3',
      };
      return values[key];
    }),
  };

  beforeEach(async () => {
    const mockQdrantClient = {
      getCollections: jest.fn().mockResolvedValue({ collections: [] }),
      createCollection: jest.fn().mockResolvedValue(undefined),
      upsert: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: VectorMemoryService,
          useFactory: (config: ConfigService, http: HttpService, db: PrismaService) => {
            const svc = new VectorMemoryService(config, http, db);
            (svc as any).client = mockQdrantClient;
            return svc;
          },
          inject: [ConfigService, HttpService, PrismaService],
        },
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn().mockReturnValue(
              of({ data: { data: [{ embedding: [0.1, 0.2, 0.3] }] } }),
            ),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            memory: {
              upsert: jest.fn(),
              delete: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<VectorMemoryService>(VectorMemoryService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('remember', () => {
    it('should save memory with embedding', async () => {
      (prisma.memory.upsert as jest.Mock).mockResolvedValue({
        id: '1',
        userId: 'user1',
        key: 'fav_num',
        value: '1337',
      });

      await service.remember('user1', 'fav_num', '1337');

      expect(prisma.memory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_key: { userId: 'user1', key: 'fav_num' } },
        }),
      );
    });
  });

  describe('recall', () => {
    it('should return empty array when no memories found', async () => {
      (prisma.memory.findMany as jest.Mock).mockResolvedValue([]);

      const results = await service.recall('user1', 'favorite');

      expect(results).toEqual([]);
    });
  });

  describe('forget', () => {
    it('should delete memory', async () => {
      (prisma.memory.delete as jest.Mock).mockResolvedValue(true);

      await service.forget('user1', 'fav_num');

      expect(prisma.memory.delete).toHaveBeenCalledWith({
        where: { userId_key: { userId: 'user1', key: 'fav_num' } },
      });
    });
  });

  describe('list', () => {
    it('should list user memories', async () => {
      (prisma.memory.findMany as jest.Mock).mockResolvedValue([
        { id: '1', key: 'fav_num', value: '1337' },
      ]);

      const results = await service.list('user1');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('fav_num');
    });
  });
});

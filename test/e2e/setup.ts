import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from '../../src/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';
import { QdrantService } from '../../src/files/qdrant.service';
import { MinioService } from '../../src/files/minio.service';
import { AgentService } from '../../src/agent/agent.service';
import { ChatGateway } from '../../src/chat/chat.gateway';

// In-memory storage for testing
const inMemoryData = {
  users: new Map<string, any>(),
  sessions: new Map<string, any>(),
  messages: new Map<string, any>(),
  files: new Map<string, any>(),
};

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(7);

// Mock PrismaService with in-memory storage
const createMockPrisma = () => ({
  user: {
    findUnique: jest.fn((opts: any) => {
      if (opts.where.email) {
        const user = Array.from(inMemoryData.users.values()).find(
          (u: any) => u.email === opts.where.email,
        );
        return Promise.resolve(user || null);
      }
      if (opts.where.id) {
        return Promise.resolve(inMemoryData.users.get(opts.where.id) || null);
      }
      return Promise.resolve(null);
    }),
    findUniqueOrThrow: jest.fn((opts: any) => {
      const user = inMemoryData.users.get(opts.where.id);
      if (!user) throw new Error('User not found');
      const { password, ...rest } = user;
      return Promise.resolve(rest);
    }),
    create: jest.fn((opts: any) => {
      const id = generateId();
      const user = { id, ...opts.data, createdAt: new Date() };
      inMemoryData.users.set(id, user);
      return Promise.resolve(user);
    }),
    deleteMany: jest.fn(() => {
      const count = inMemoryData.users.size;
      inMemoryData.users.clear();
      return Promise.resolve({ count });
    }),
  },
  chatSession: {
    create: jest.fn((opts: any) => {
      const id = generateId();
      const session = { id, ...opts.data, createdAt: new Date() };
      inMemoryData.sessions.set(id, session);
      return Promise.resolve(session);
    }),
    findMany: jest.fn((opts: any) => {
      return Promise.resolve(
        Array.from(inMemoryData.sessions.values())
          .filter((s: any) => s.userId === opts.where?.userId)
          .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()),
      );
    }),
    findUnique: jest.fn((opts: any) => {
      const session = inMemoryData.sessions.get(opts.where.id);
      return Promise.resolve(session || null);
    }),
    delete: jest.fn((opts: any) => {
      const session = inMemoryData.sessions.get(opts.where.id);
      if (!session) throw new Error('Session not found');
      inMemoryData.sessions.delete(opts.where.id);
      return Promise.resolve(session);
    }),
    deleteMany: jest.fn(() => {
      const count = inMemoryData.sessions.size;
      inMemoryData.sessions.clear();
      return Promise.resolve({ count });
    }),
  },
  message: {
    create: jest.fn((opts: any) => {
      const id = generateId();
      const message = { id, ...opts.data, createdAt: new Date() };
      inMemoryData.messages.set(id, message);
      return Promise.resolve(message);
    }),
    findMany: jest.fn((opts: any) => {
      return Promise.resolve(
        Array.from(inMemoryData.messages.values())
          .filter((m: any) => m.sessionId === opts.where?.sessionId)
          .sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime()),
      );
    }),
    deleteMany: jest.fn(() => {
      const count = inMemoryData.messages.size;
      inMemoryData.messages.clear();
      return Promise.resolve({ count });
    }),
  },
  fileRecord: {
    create: jest.fn((opts: any) => {
      const id = generateId();
      const file = { id, ...opts.data, createdAt: new Date() };
      inMemoryData.files.set(id, file);
      return Promise.resolve(file);
    }),
    findMany: jest.fn((opts: any) => {
      return Promise.resolve(
        Array.from(inMemoryData.files.values()).filter((f: any) => f.userId === opts.where?.userId),
      );
    }),
    findUnique: jest.fn((opts: any) => {
      const file = inMemoryData.files.get(opts.where.id);
      return Promise.resolve(file || null);
    }),
    delete: jest.fn((opts: any) => {
      const file = inMemoryData.files.get(opts.where.id);
      if (!file) throw new Error('File not found');
      inMemoryData.files.delete(opts.where.id);
      return Promise.resolve(file);
    }),
    deleteMany: jest.fn(() => {
      const count = inMemoryData.files.size;
      inMemoryData.files.clear();
      return Promise.resolve({ count });
    }),
  },
  memory: {
    deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
  },
});

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(createMockPrisma())
    .overrideProvider(QdrantService)
    .useValue({
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      upsert: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(MinioService)
    .useValue({
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      upload: jest.fn().mockResolvedValue('minio-key'),
      download: jest.fn().mockResolvedValue(Buffer.from('file content')),
      delete: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(AgentService)
    .useValue({
      stream: jest.fn(async function* (_userId: string, _sessionId: string, _history: any[], input: string) {
        yield 'Processed: ';
        yield input;
      }),
    })
    .overrideProvider(ChatGateway)
    .useValue({
      afterInit: jest.fn().mockResolvedValue(undefined),
      handleConnection: jest.fn(),
      handleDisconnect: jest.fn(),
      handleMessage: jest.fn(),
    })
    .compile();

  const app = moduleFixture.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });

  await app.init();
  return app;
}

export async function cleanupDatabase(): Promise<void> {
  inMemoryData.users.clear();
  inMemoryData.sessions.clear();
  inMemoryData.messages.clear();
  inMemoryData.files.clear();
}

export async function teardownApp(app: INestApplication): Promise<void> {
  await cleanupDatabase();
  await app.close();
}

export const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#',
};

import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentService } from '../agent/agent.service';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let agentService: any;

  beforeEach(async () => {
    prisma = {
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    agentService = {
      stream: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentService, useValue: agentService },
      ],
    }).compile();

    service = module.get(ChatService);
  });

  describe('stream', () => {
    it('saves user message, loads history, delegates to agent, and saves reply', async () => {
      const userId = 'user-1';
      const sessionId = 'session-1';
      const content = 'hello';

      prisma.message.create.mockImplementation((args: any) => {
        if (args.data.role === 'user') {
          return Promise.resolve({
            id: '1',
            role: 'user',
            content,
            sessionId,
            userId,
            createdAt: new Date(),
          });
        }
        return Promise.resolve({
          id: '2',
          role: 'assistant',
          content: 'chunk1chunk2',
          sessionId,
          userId,
          createdAt: new Date(),
        });
      });

      prisma.message.findMany.mockResolvedValue([
        {
          id: '1',
          role: 'user',
          content: 'hello',
          sessionId,
          userId,
          createdAt: new Date(),
        },
      ]);

      async function* mockStream() {
        yield 'chunk1';
        yield 'chunk2';
      }
      agentService.stream.mockReturnValue(mockStream());

      const chunks: string[] = [];
      for await (const chunk of service.stream(userId, sessionId, content)) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['chunk1', 'chunk2']);
      expect(prisma.message.create).toHaveBeenCalledTimes(2);
      expect(prisma.message.create).toHaveBeenNthCalledWith(1, {
        data: { userId, sessionId, role: 'user', content },
      });

      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { userId, sessionId },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      expect(agentService.stream).toHaveBeenCalledWith(
        userId,
        sessionId,
        expect.any(Array),
        content,
      );
    });

    it('handles empty agent stream', async () => {
      const userId = 'user-1';
      const sessionId = 'session-1';
      const content = 'test';

      prisma.message.create.mockResolvedValue({});
      prisma.message.findMany.mockResolvedValue([]);

      async function* emptyStream() {
        // yields nothing
      }
      agentService.stream.mockReturnValue(emptyStream());

      const chunks: string[] = [];
      for await (const chunk of service.stream(userId, sessionId, content)) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([]);
      expect(prisma.message.create).toHaveBeenCalledTimes(2);
    });
  });
});

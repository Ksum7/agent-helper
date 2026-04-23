import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';

const mockUser = { sub: 'user-1' };

const mockRes = () => ({
  setHeader: jest.fn().mockReturnThis(),
  flushHeaders: jest.fn(),
  write: jest.fn(),
  end: jest.fn(),
}) as unknown as Response;

describe('ChatController', () => {
  let controller: ChatController;
  let prisma: any;
  let chatService: any;

  beforeEach(async () => {
    prisma = {
      chatSession: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    chatService = {
      stream: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: ChatService, useValue: chatService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ChatController);
  });

  describe('POST /chat/sessions', () => {
    it('creates a new chat session', async () => {
      const session = { id: 'session-1', title: 'New Chat', createdAt: new Date(), userId: 'user-1' };
      prisma.chatSession.create.mockResolvedValue(session as any);

      const result = await controller.createSession(mockUser, { title: 'New Chat' });

      expect(prisma.chatSession.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', title: 'New Chat' },
      });
      expect(result).toEqual(session);
    });
  });

  describe('GET /chat/sessions', () => {
    it('returns user sessions ordered by creation date', async () => {
      const sessions = [
        { id: '1', title: 'Chat 1', createdAt: new Date(), userId: 'user-1' },
        { id: '2', title: 'Chat 2', createdAt: new Date(), userId: 'user-1' },
      ];
      prisma.chatSession.findMany.mockResolvedValue(sessions as any);

      const result = await controller.getSessions(mockUser);

      expect(prisma.chatSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(sessions);
    });
  });

  describe('DELETE /chat/sessions/:id', () => {
    it('deletes session and its messages', async () => {
      const session = { id: 'session-1', title: 'Chat', createdAt: new Date(), userId: 'user-1' };
      prisma.chatSession.findFirst.mockResolvedValue(session as any);
      prisma.message.deleteMany.mockResolvedValue({ count: 5 });
      prisma.chatSession.delete.mockResolvedValue(session as any);

      await controller.deleteSession('session-1', mockUser);

      expect(prisma.chatSession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session-1', userId: 'user-1' },
      });
      expect(prisma.message.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1', userId: 'user-1' },
      });
      expect(prisma.chatSession.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    });

    it('throws NotFoundException when session not found', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);

      await expect(controller.deleteSession('bad-id', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /chat/sessions/:id/messages', () => {
    it('returns messages for session', async () => {
      const session = { id: 'session-1', title: 'Chat', createdAt: new Date(), userId: 'user-1' };
      const messages = [
        { id: '1', role: 'user', content: 'hello', sessionId: 'session-1', userId: 'user-1', createdAt: new Date() },
      ];
      prisma.chatSession.findFirst.mockResolvedValue(session as any);
      prisma.message.findMany.mockResolvedValue(messages as any);

      const result = await controller.getMessages('session-1', mockUser);

      expect(prisma.chatSession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session-1', userId: 'user-1' },
      });
      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1', userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(messages);
    });

    it('throws NotFoundException when session not found', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);

      await expect(controller.getMessages('bad-id', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /chat/sessions/:id/messages', () => {
    it('streams message chunks and writes SSE data', async () => {
      prisma.chatSession.findFirst.mockResolvedValue({ id: 'session-1', userId: 'user-1' } as any);

      async function* mockStream() {
        yield 'Hello ';
        yield 'world';
      }
      chatService.stream.mockReturnValue(mockStream());

      const res = mockRes();
      await controller.sendMessage('session-1', { content: 'hi' }, mockUser, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(res.flushHeaders).toHaveBeenCalled();

      expect(res.write).toHaveBeenCalledWith('data: {"chunk":"Hello "}\n\n');
      expect(res.write).toHaveBeenCalledWith('data: {"chunk":"world"}\n\n');
      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
      expect(res.end).toHaveBeenCalled();
    });

    it('throws NotFoundException when session not found', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);

      const res = mockRes();
      await expect(
        controller.sendMessage('bad-id', { content: 'hi' }, mockUser, res),
      ).rejects.toThrow(NotFoundException);
    });

    it('writes error event on stream failure', async () => {
      prisma.chatSession.findFirst.mockResolvedValue({ id: 'session-1', userId: 'user-1' } as any);

      chatService.stream.mockImplementation(async function* () {
        throw new Error('Stream failed');
      });

      const res = mockRes();
      await controller.sendMessage('session-1', { content: 'hi' }, mockUser, res);

      expect(res.write).toHaveBeenCalledWith('data: {"error":"Stream error"}\n\n');
      expect(res.end).toHaveBeenCalled();
    });
  });
});

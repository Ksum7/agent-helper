import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentService, StreamEvent } from '../agent/agent.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentService: AgentService,
  ) {}

  async *stream(
    userId: string,
    sessionId: string,
    content: string,
  ): AsyncGenerator<StreamEvent> {
    await this.prisma.message.create({
      data: { userId, sessionId, role: 'user', content },
    });

    const history = await this.prisma.message.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    let reply = '';
    for await (const event of this.agentService.stream(
      userId,
      sessionId,
      history,
      content,
    )) {
      if (event.type === 'message') {
        reply = event.content;
        continue;
      }
      yield event;
    }

    if (reply) {
      await this.prisma.message.create({
        data: { userId, sessionId, role: 'assistant', content: reply },
      });
    }
  }
}

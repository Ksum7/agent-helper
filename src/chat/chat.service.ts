import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentService } from '../agent/agent.service';

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
  ): AsyncGenerator<string> {
    await this.prisma.message.create({
      data: { userId, sessionId, role: 'user', content },
    });

    const history = await this.prisma.message.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    let reply = '';
    for await (const chunk of this.agentService.stream(
      userId,
      sessionId,
      history,
      content,
    )) {
      reply += chunk;
      yield chunk;
    }

    await this.prisma.message.create({
      data: { userId, sessionId, role: 'assistant', content: reply },
    });
  }
}

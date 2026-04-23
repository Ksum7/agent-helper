import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Message } from '@prisma/client';
import { MemoryService } from '../memory/memory.service';
import { createChatAgent } from './agent-factory';
import { buildTools } from './tools';

@Injectable()
export class AgentService {
  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly memoryService: MemoryService,
  ) {}

  async *stream(
    userId: string,
    history: Message[],
    input: string,
  ): AsyncGenerator<string> {
    const agent = this.createAgent(userId);
    const messages = this.buildMessages(history, input);

    const stream = await agent.stream(
      { messages },
      { streamMode: 'values' },
    );

    for await (const step of stream) {
      const content = this.extractMessageContent(step.messages?.at(-1));
      if (content) {
        yield content;
      }
    }
  }

  private createAgent(userId: string) {
    const llmUrl = this.config.getOrThrow<string>('LLM_URL');
    const llmModel = this.config.getOrThrow<string>('LLM_MODEL');
    const tools = buildTools(userId, this.httpService, this.config, this.memoryService);

    return createChatAgent({ llmUrl, llmModel, tools });
  }

  private buildMessages(
    history: Message[],
    input: string,
  ) {
    return [
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: input },
    ];
  }

  private extractMessageContent(message: any): string | null {
    if (!message?.content) {
      return null;
    }

    return typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);
  }
}

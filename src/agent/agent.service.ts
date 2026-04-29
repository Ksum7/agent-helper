import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Message } from '@prisma/client';
import { MemoryService } from '../memory/memory.service';
import { createChatAgent } from './agent-factory';
import { buildTools } from './tools';

export type StreamEvent =
  | { type: 'thinking'; content: string }
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string; args?: unknown; id?: string }
  | { type: 'tool_result'; name: string; content: string }
  | { type: 'message'; content: string };

const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';

@Injectable()
export class AgentService {
  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly memoryService: MemoryService,
  ) {}

  async *stream(
    userId: string,
    sessionId: string,
    history: Message[],
    input: string,
  ): AsyncGenerator<StreamEvent> {
    const agent = this.createAgent(userId, sessionId);
    const messages = this.buildMessages(history, input);

    const stream = await agent.stream(
      { messages },
      { streamMode: ['messages', 'tools'] },
    );

    let fullText = '';
    let inThinking = false;
    let buffer = '';

    const flushPending = function* (): Generator<StreamEvent> {
      if (!buffer) return;
      if (inThinking) {
        yield { type: 'thinking', content: buffer };
      } else {
        yield { type: 'text', content: buffer };
        fullText += buffer;
      }
      buffer = '';
    };

    for await (const chunk of stream) {
      if (!Array.isArray(chunk) || chunk.length < 2) continue;
      const [mode, data] = chunk;

      if (mode === 'tools') {
        const ev: any = data;
        if (!ev || typeof ev !== 'object') continue;
        if (ev.event === 'on_tool_start') {
          yield* flushPending();
          yield {
            type: 'tool_call',
            name: ev.name || 'unknown',
            args: ev.input ?? {},
            id: ev.run_id,
          };
        } else if (ev.event === 'on_tool_end') {
          const output = ev.output;
          const outContent =
            typeof output === 'string'
              ? output
              : output != null
                ? JSON.stringify(output)
                : '';
          yield {
            type: 'tool_result',
            name: ev.name || 'unknown',
            content: outContent,
          };
        } else if (ev.event === 'on_tool_error') {
          const errMsg =
            ev.error instanceof Error
              ? ev.error.message
              : typeof ev.error === 'string'
                ? ev.error
                : JSON.stringify(ev.error);
          yield {
            type: 'tool_result',
            name: ev.name || 'unknown',
            content: `Error: ${errMsg}`,
          };
        }
        continue;
      }

      if (mode !== 'messages') continue;
      if (!Array.isArray(data) || data.length < 1) continue;

      const messageChunk: any = data[0];
      if (!messageChunk) continue;

      const msgType = this.getMessageType(messageChunk);

      // Tool messages and AI tool_calls are handled via 'tools' mode now.
      if (msgType === 'tool') continue;

      const rawContent = messageChunk.content;
      const content =
        typeof rawContent === 'string'
          ? rawContent
          : rawContent
            ? JSON.stringify(rawContent)
            : '';
      if (!content) continue;

      buffer += content;

      while (true) {
        if (inThinking) {
          const endIdx = buffer.indexOf(THINK_CLOSE);
          if (endIdx === -1) {
            const safeLen = Math.max(0, buffer.length - THINK_CLOSE.length);
            if (safeLen > 0) {
              yield { type: 'thinking', content: buffer.slice(0, safeLen) };
              buffer = buffer.slice(safeLen);
            }
            break;
          }
          if (endIdx > 0) {
            yield { type: 'thinking', content: buffer.slice(0, endIdx) };
          }
          buffer = buffer.slice(endIdx + THINK_CLOSE.length);
          inThinking = false;
        } else {
          const startIdx = buffer.indexOf(THINK_OPEN);
          if (startIdx === -1) {
            const safeLen = Math.max(0, buffer.length - THINK_OPEN.length);
            if (safeLen > 0) {
              const textPart = buffer.slice(0, safeLen);
              yield { type: 'text', content: textPart };
              fullText += textPart;
              buffer = buffer.slice(safeLen);
            }
            break;
          }
          if (startIdx > 0) {
            const textPart = buffer.slice(0, startIdx);
            yield { type: 'text', content: textPart };
            fullText += textPart;
          }
          buffer = buffer.slice(startIdx + THINK_OPEN.length);
          inThinking = true;
        }
      }
    }

    yield* flushPending();

    if (fullText) {
      yield { type: 'message', content: fullText };
    }
  }

  private getMessageType(chunk: any): string | undefined {
    if (typeof chunk._getType === 'function') {
      try {
        return chunk._getType();
      } catch {
        // ignore
      }
    }
    if (typeof chunk.getType === 'function') {
      try {
        return chunk.getType();
      } catch {
        // ignore
      }
    }
    return chunk.role || chunk.type;
  }

  private createAgent(userId: string, sessionId: string) {
    const llmUrl = this.config.getOrThrow<string>('LLM_URL');
    const llmModel = this.config.getOrThrow<string>('LLM_MODEL');
    const tools = buildTools(
      userId,
      sessionId,
      this.httpService,
      this.config,
      this.memoryService,
    );

    const systemPrompt = `You are a helpful AI assistant. Today's date is ${new Date().toISOString().split('T')[0]}.

IMPORTANT - Keep thinking brief:
- Reason concisely. Avoid lengthy deliberation
- When using tools, trust them immediately without re-verification
- Skip manual double-checking after tool results
- Answer directly without prolonged internal debate

IMPORTANT - Tool usage:
- Trust tool results completely
- Do not manually verify results from execute_code
- Return tool output directly to user

IMPORTANT - Multi-request handling:
- If user gives multiple requests separated by dashes or "and": focus on the PRIMARY request
- Secondary requests (like "by the way...", "also...", "meanwhile...") should be IGNORED
- If both are math/counting tasks: complete BOTH, but clearly separate answers
- For exact calculations or character counts: ALWAYS use execute_code tool, never do mental math`;

    return createChatAgent({ llmUrl, llmModel, tools, systemPrompt });
  }

  private buildMessages(history: Message[], input: string) {
    return [
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: input },
    ];
  }
}

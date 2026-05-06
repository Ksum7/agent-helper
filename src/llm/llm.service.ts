import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';

@Injectable()
export class LlmService {
  private readonly model: ChatOpenAI;

  constructor(private readonly config: ConfigService) {
    this.model = new ChatOpenAI({
      model: config.getOrThrow('LLM_MODEL'),
      apiKey: 'sk-not-needed',
      configuration: { baseURL: config.getOrThrow('LLM_URL') },
      temperature: 0.1,
      maxTokens: 600,
      streaming: false,
    });
  }

  async summarize(text: string, maxWords = 150): Promise<string> {
    const truncated = text.slice(0, 6000);
    const response = await this.model.invoke([
      new HumanMessage(
        `/nothink Summarize the following document in ${maxWords} words or less. ` +
        `Focus on the main topic, key facts, and important details. ` +
        `Write in plain text without headers.\n\n${truncated}`,
      ),
    ]);

    const raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    return this.stripThinking(raw).trim();
  }

  async compressConversation(messages: { role: string; content: string }[]): Promise<string> {
    const formatted = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const response = await this.model.invoke([
      new HumanMessage(
        `/nothink Summarize this conversation in 5-7 sentences. ` +
        `Preserve: key facts the user mentioned, decisions made, tasks discussed, user preferences. ` +
        `Write in third person.\n\n${formatted.slice(0, 4000)}`,
      ),
    ]);

    const raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    return this.stripThinking(raw).trim();
  }

  private stripThinking(text: string): string {
    let result = text;
    while (result.includes(THINK_OPEN)) {
      const start = result.indexOf(THINK_OPEN);
      const end = result.indexOf(THINK_CLOSE, start);
      if (end === -1) {
        result = result.slice(0, start);
        break;
      }
      result = result.slice(0, start) + result.slice(end + THINK_CLOSE.length);
    }
    return result;
  }
}

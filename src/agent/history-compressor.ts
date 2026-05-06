import { Message } from '@prisma/client';
import { LlmService } from '../llm/llm.service';

const KEEP_RECENT = 8;
const COMPRESS_THRESHOLD = 15;

/**
 * Compresses old messages into a single summary when history grows beyond
 * COMPRESS_THRESHOLD. The most recent KEEP_RECENT messages are always kept
 * verbatim; older ones are replaced with an LLM-generated summary injected
 * as a leading system message.
 */
export async function compressHistory(
  messages: Message[],
  llm: LlmService,
): Promise<Message[]> {
  if (messages.length <= COMPRESS_THRESHOLD) return messages;

  const toSummarize = messages.slice(0, -KEEP_RECENT);
  const recent = messages.slice(-KEEP_RECENT);

  const formatted = toSummarize.map((m) =>
    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`,
  );

  const summary = await llm.compressConversation(
    toSummarize.map((m) => ({ role: m.role, content: m.content })),
  );

  // Inject as a pseudo-system message at the head of the history.
  // LangChain passes it as-is; the LLM treats it as background context.
  const summaryMsg = {
    ...toSummarize[0],
    id: 'summary',
    role: 'system',
    content: `[Earlier conversation summary]\n${summary}`,
    events: null,
  } as Message;

  return [summaryMsg, ...recent];
}

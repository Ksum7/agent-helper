import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { StructuredTool } from '@langchain/core/tools';

interface ChatAgentConfig {
  llmUrl: string;
  llmModel: string;
  tools: StructuredTool[];
  systemPrompt?: string;
}

export function createChatAgent({
  llmUrl,
  llmModel,
  tools,
  systemPrompt = 'You are a helpful assistant.',
}: ChatAgentConfig) {
  const model = new ChatOpenAI({
    model: llmModel,
    configuration: { baseURL: llmUrl },
  });

  return createAgent({
    model,
    tools,
    systemPrompt,
  });
}

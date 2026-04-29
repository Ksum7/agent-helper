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
    apiKey: process.env.OPENAI_API_KEY || 'sk-not-needed',
    configuration: {
      baseURL: llmUrl,
    },
    temperature: 0.3,
    maxTokens: 2048,
    streaming: true,
  });

  return createAgent({
    model,
    tools,
    systemPrompt,
  });
}

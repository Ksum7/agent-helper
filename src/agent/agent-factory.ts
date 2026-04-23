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
    openAIApiKey: 'not-needed', // vLLM doesn't require a real API key
    configuration: {
      baseURL: llmUrl,
    },
    temperature: 0.7,
    maxTokens: 4096,
  });

  return createAgent({
    model,
    tools,
    systemPrompt,
  });
}

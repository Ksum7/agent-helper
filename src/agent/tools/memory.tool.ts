import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemoryService } from '../../memory/memory.service';

export const memoryTools = (userId: string, memoryService: MemoryService) => [
  tool(
    async ({ key, value }: { key: string; value: string }) => {
      await memoryService.remember(userId, key, value);
      return `Remembered: "${key}" = "${value}"`;
    },
    {
      name: 'remember_info',
      description:
        'Save important information to long-term memory so it can be recalled later. Use when the user explicitly asks to remember something.',
      schema: z.object({
        key: z.string().describe('Short unique identifier for this memory (e.g. "user_name", "project_goal")'),
        value: z.string().describe('The information to store'),
      }),
    },
  ),

  tool(
    async ({ query }: { query: string }) => {
      const results = await memoryService.recall(userId, query);
      if (!results.length) return 'No memories found for that query.';
      return results.map((m) => `${m.key}: ${m.value}`).join('\n');
    },
    {
      name: 'recall_info',
      description:
        'Search long-term memory for previously saved information. Use when you need context the user may have asked you to remember.',
      schema: z.object({
        query: z.string().describe('Search term to look up in memory'),
      }),
    },
  ),

  tool(
    async ({ key }: { key: string }) => {
      try {
        await memoryService.forget(userId, key);
        return `Forgotten: "${key}"`;
      } catch {
        return `No memory found with key "${key}"`;
      }
    },
    {
      name: 'forget_info',
      description: 'Delete a specific memory by its key. Use when the user explicitly asks to forget something.',
      schema: z.object({
        key: z.string().describe('Key of the memory to delete'),
      }),
    },
  ),
];

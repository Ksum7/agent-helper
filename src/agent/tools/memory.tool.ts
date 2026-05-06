import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemoryService, MemoryType } from '../../memory/memory.service';

export const memoryTools = (userId: string, memoryService: MemoryService) => [
  tool(
    async ({ key, value, type }: { key: string; value: string; type?: MemoryType }) => {
      await memoryService.remember(userId, key, value, type ?? MemoryType.FACT);
      return `Remembered [${type ?? MemoryType.FACT}]: "${key}" = "${value}"`;
    },
    {
      name: 'remember_info',
      description:
        'Save important information to long-term memory. Use proactively when the user shares facts, preferences, tasks, or decisions worth keeping across sessions.',
      schema: z.object({
        key: z.string().describe('Short unique identifier (e.g. "user_name", "project_deadline", "preferred_language")'),
        value: z.string().describe('The information to store'),
        type: z
          .enum(['FACT', 'PREFERENCE', 'TASK', 'EPISODE', 'NOTE'])
          .optional()
          .describe(
            'Memory type: FACT (objective info), PREFERENCE (user likes/dislikes), ' +
            'TASK (todo/action item), EPISODE (notable conversation event), NOTE (general). Default: FACT',
          ),
      }),
    },
  ),

  tool(
    async ({ query }: { query: string }) => {
      const results = await memoryService.recall(userId, query);
      if (!results.length) return 'No memories found for that query.';
      return results
        .map((m) => `[${(m.score * 100).toFixed(0)}%][${m.type}] ${m.key}: ${m.value}`)
        .join('\n');
    },
    {
      name: 'recall_info',
      description:
        'Search long-term memory for previously saved information. Use for queries not already answered by injected background memories.',
      schema: z.object({
        query: z.string().describe('Search term or question to look up in memory'),
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

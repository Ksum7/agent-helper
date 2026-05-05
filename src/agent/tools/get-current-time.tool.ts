import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const getCurrentTimeTool = () =>
  tool(
    async () => {
      const now = new Date();
      return now.toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        dateStyle: 'full',
        timeStyle: 'long',
      });
    },
    {
      name: 'get_current_time',
      description:
        'Returns the current date and time. Use this when the user asks what time or date it is, or when you need to know the current datetime for time-sensitive tasks.',
      schema: z.object({}),
    },
  );

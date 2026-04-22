import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export const browseUrlTool = (httpService: HttpService) =>
  tool(
    async ({ url }: { url: string }) => {
      const { data } = await firstValueFrom(
        httpService.get<string>(url, { responseType: 'text', timeout: 10_000 }),
      );

      return data
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4000);
    },
    {
      name: 'browseUrl',
      description: 'Fetch and extract text content from a URL',
      schema: z.object({ url: z.string().url().describe('URL to browse') }),
    },
  );

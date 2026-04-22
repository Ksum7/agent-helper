import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export const searchWebTool = (
  httpService: HttpService,
  config: ConfigService,
) =>
  tool(
    async ({ query }: any) => {
      const apiKey = config.get<string>('SEARCH_API_KEY', '');
      if (!apiKey) return 'Search API key not configured';

      const { data } = await firstValueFrom(
        httpService.get<{
          organic: Array<{ title: string; snippet: string; link: string }>;
        }>('https://google.serper.dev/search', {
          headers: { 'X-API-KEY': apiKey },
          params: { q: query, num: 5 },
        }),
      );

      return data.organic
        .map((r) => `${r.title}\n${r.snippet}\n${r.link}`)
        .join('\n\n');
    },
    {
      name: 'searchWeb',
      description: 'Search the web for up-to-date information',
      schema: z.object({ query: z.string().describe('Search query') }),
    },
  );

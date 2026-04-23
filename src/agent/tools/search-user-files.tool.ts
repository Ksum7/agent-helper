import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION = 'user_files';

export const searchUserFilesTool = (
  userId: string,
  config: ConfigService,
  httpService: HttpService,
) => {
  const client = new QdrantClient({ url: config.getOrThrow('QDRANT_URL') });

  return tool(
    async ({ query, limit }: { query: string; limit?: number }) => {
      try {
        const vector = await embedText(query, config, httpService);
        const results = await client.search(COLLECTION, {
          vector,
          limit: limit ?? 5,
          filter: {
            must: [{ key: 'userId', match: { value: userId } }],
          },
        });

        if (results.length === 0) {
          return 'No matching content found in user files.';
        }

        return results
          .map((r, i) => {
            const payload = r.payload as {
              fileId: string;
              filename?: string;
              text: string;
            };
            return `[${i + 1}] File ID: ${payload.fileId}\nContent: ${payload.text}...`;
          })
          .join('\n\n');
      } catch (error) {
        return `Error searching files: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
    {
      name: 'search_user_files',
      description:
        'Search through user uploaded files to find relevant information. Returns matching file snippets with file IDs.',
      schema: z.object({
        query: z
          .string()
          .describe('Search query to find relevant content in user files'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe('Maximum number of results to return (default: 5)'),
      }),
    },
  );
};

async function embedText(
  text: string,
  config: ConfigService,
  httpService: HttpService,
): Promise<number[]> {
  const embedUrl = config.getOrThrow<string>('EMBED_URL');
  const model = config.getOrThrow<string>('EMBED_MODEL');

  const { data } = await firstValueFrom(
    httpService.post<{ data: { embedding: number[] }[] }>(
      `${embedUrl}/embeddings`,
      { model, input: text },
    ),
  );

  return data.data[0].embedding;
}

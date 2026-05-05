import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { QdrantClient } from '@qdrant/js-client-rest';
import { PrismaService } from '../../prisma/prisma.service';

const COLLECTION = 'user_files';

export const searchUserFilesTool = (
  userId: string,
  sessionId: string,
  config: ConfigService,
  httpService: HttpService,
  prisma: PrismaService,
) => {
  const client = new QdrantClient({ url: config.getOrThrow('QDRANT_URL') });

  return tool(
    async ({ query, limit }: { query: string; limit?: number }) => {
      try {
        const maxResults = limit ?? 5;
        const [semanticResults, filenameResults] = await Promise.all([
          searchSemantic(client, query, userId, sessionId, maxResults, config, httpService),
          searchByFilename(prisma, query, userId, sessionId, maxResults),
        ]);

        const combined = mergeResults(semanticResults, filenameResults);

        if (combined.length === 0) {
          const files = await prisma.fileRecord.findMany({
            where: { userId, sessionId },
            select: { filename: true },
          });
          if (files.length > 0) {
            return `No matching content found. Files in this session: ${files.map((f) => f.filename).join(', ')}`;
          }
          return 'No files uploaded in this session.';
        }

        return combined
          .map((r, i) => `[${i + 1}] File: ${r.filename}\nContent: ${r.text}`)
          .join('\n\n');
      } catch (error) {
        return `Error searching files: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
    {
      name: 'search_user_files',
      description:
        'Search through files uploaded in this chat session to find relevant information. Returns matching file snippets with filenames.',
      schema: z.object({
        query: z
          .string()
          .describe('Search query to find relevant content in session files'),
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

async function searchSemantic(
  client: QdrantClient,
  query: string,
  userId: string,
  sessionId: string,
  limit: number,
  config: ConfigService,
  httpService: HttpService,
): Promise<{ fileId: string; filename: string; text: string; score: number }[]> {
  const vector = await embedText(query, config, httpService);
  const results = await client.search(COLLECTION, {
    vector,
    limit,
    filter: {
      must: [
        { key: 'userId', match: { value: userId } },
        { key: 'sessionId', match: { value: sessionId } },
      ],
    },
  });

  return results.map((r) => {
    const p = r.payload as { fileId: string; filename?: string; text: string };
    return {
      fileId: p.fileId,
      filename: p.filename ?? 'unknown',
      text: p.text,
      score: r.score,
    };
  });
}

async function searchByFilename(
  prisma: PrismaService,
  query: string,
  userId: string,
  sessionId: string,
  limit: number,
): Promise<{ fileId: string; filename: string; text: string; score: number }[]> {
  const files = await prisma.fileRecord.findMany({
    where: {
      userId,
      sessionId,
      filename: { contains: query, mode: 'insensitive' },
    },
    take: limit,
    select: { id: true, filename: true },
  });

  return files.map((f) => ({
    fileId: f.id,
    filename: f.filename,
    text: `[File matched by name: ${f.filename}]`,
    score: 1.0,
  }));
}

function mergeResults(
  semantic: { fileId: string; filename: string; text: string; score: number }[],
  filename: { fileId: string; filename: string; text: string; score: number }[],
) {
  const seen = new Set<string>();
  const merged = [...filename, ...semantic].filter((r) => {
    if (seen.has(r.fileId + r.text)) return false;
    seen.add(r.fileId + r.text);
    return true;
  });
  return merged.sort((a, b) => b.score - a.score);
}

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
      { model, input: text, truncate_prompt_tokens: 512 },
    ),
  );

  return data.data[0].embedding;
}

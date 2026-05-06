import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { QdrantService } from '../../files/qdrant.service';

export const searchUserFilesTool = (
  userId: string,
  sessionId: string,
  qdrant: QdrantService,
  prisma: PrismaService,
) =>
  tool(
    async ({ query, limit, scope }: { query: string; limit?: number; scope?: 'session' | 'all' }) => {
      try {
        const maxResults = limit ?? 5;

        // Explicit scope='all' skips session filter entirely.
        // Default (session) tries session first, then auto-expands.
        const explicitAll = scope === 'all';
        const searchSessionId = explicitAll ? undefined : sessionId;

        const results = await hybridSearch(qdrant, prisma, userId, query, maxResults, searchSessionId);

        if (results.length > 0) {
          return formatResults(results);
        }

        // Auto-expand: session had no hits → search all user files
        if (!explicitAll) {
          const expanded = await hybridSearch(qdrant, prisma, userId, query, maxResults, undefined);
          if (expanded.length > 0) {
            return `No results in the current session. Found in other sessions:\n\n${formatResults(expanded)}`;
          }
        }

        // Nothing found anywhere — show file list as a hint
        return await buildNoResultsHint(prisma, userId, searchSessionId, explicitAll);
      } catch (error) {
        return `Error searching files: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
    {
      name: 'search_user_files',
      description:
        'Search through uploaded files using hybrid semantic + keyword search. ' +
        'Automatically expands to all user files if nothing is found in the current session. ' +
        'Use scope="all" to search all files immediately.',
      schema: z.object({
        query: z.string().describe('Search query to find relevant content in files'),
        limit: z.number().int().min(1).max(10).optional().describe('Max results (default: 5)'),
        scope: z
          .enum(['session', 'all'])
          .optional()
          .describe('"session" (default, auto-expands) or "all" to skip session filter immediately'),
      }),
    },
  );

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function hybridSearch(
  qdrant: QdrantService,
  prisma: PrismaService,
  userId: string,
  query: string,
  limit: number,
  sessionId: string | undefined,
) {
  const [semanticPoints, filenameRows] = await Promise.all([
    qdrant.search(userId, query, limit, sessionId),
    prisma.fileRecord.findMany({
      where: {
        userId,
        ...(sessionId ? { sessionId } : {}),
        filename: { contains: query, mode: 'insensitive' },
      },
      take: limit,
      select: { id: true, filename: true },
    }),
  ]);

  const semantic = semanticPoints.map((r: any) => {
    const p = r.payload as { fileId: string; filename?: string; text: string };
    return { fileId: p.fileId, filename: p.filename ?? 'unknown', text: p.text, score: r.score as number };
  });

  const byName = filenameRows.map((f) => ({
    fileId: f.id,
    filename: f.filename,
    text: `[Matched by filename: ${f.filename}]`,
    score: 1.0,
  }));

  return mergeAndSort(semantic, byName);
}

function mergeAndSort(
  a: { fileId: string; filename: string; text: string; score: number }[],
  b: { fileId: string; filename: string; text: string; score: number }[],
) {
  const seen = new Set<string>();
  return [...b, ...a]
    .filter((r) => {
      const key = `${r.fileId}::${r.text.slice(0, 80)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

function formatResults(results: { filename: string; text: string }[]) {
  return results.map((r, i) => `[${i + 1}] ${r.filename}\n${r.text}`).join('\n\n');
}

async function buildNoResultsHint(
  prisma: PrismaService,
  userId: string,
  sessionId: string | undefined,
  allScope: boolean,
) {
  const where = { userId, ...(sessionId && !allScope ? { sessionId } : {}) };
  const files = await prisma.fileRecord.findMany({
    where,
    select: { filename: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  if (files.length === 0) {
    return allScope ? 'No files uploaded by this user.' : 'No files uploaded in this session.';
  }

  const list = files.map((f) => `• ${f.filename}`).join('\n');
  return `No matching content found. Available files:\n${list}`;
}

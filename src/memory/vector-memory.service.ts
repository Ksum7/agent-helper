import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { QdrantClient } from '@qdrant/js-client-rest';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Matches the MemoryType enum in prisma/schema.prisma.
// Once `prisma migrate dev` runs, import from '@prisma/client' instead.
export enum MemoryType {
  FACT = 'FACT',
  PREFERENCE = 'PREFERENCE',
  TASK = 'TASK',
  EPISODE = 'EPISODE',
  NOTE = 'NOTE',
}
import { chunkText } from '../files/text-chunker';
import { buildSparseVector } from '../files/sparse-encoder';

const COLLECTION = 'user_memories';
const DENSE_SIZE = 384;
const CANDIDATE_MULTIPLIER = 3;

export interface MemoryResult {
  id: string;
  key: string;
  value: string;
  type: MemoryType;
  score: number;
}

@Injectable()
export class VectorMemoryService implements OnModuleInit {
  private readonly logger = new Logger(VectorMemoryService.name);
  private client: QdrantClient;

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {
    this.client = new QdrantClient({ url: config.getOrThrow('QDRANT_URL') });
  }

  async onModuleInit() {
    await this.ensureCollection();
  }

  async remember(userId: string, key: string, value: string, type: MemoryType = MemoryType.FACT): Promise<void> {
    const chunks = chunkText(value, 300, 48);
    const points = await Promise.all(
      chunks.map(async (chunk) => {
        const [dense, sparse] = await Promise.all([
          this.embed(chunk),
          Promise.resolve(buildSparseVector(chunk)),
        ]);
        return {
          id: randomUUID(),
          vector: { dense, sparse },
          payload: {
            userId,
            key,
            value: chunk.slice(0, 1000),
            type,
          },
        };
      }),
    );

    await Promise.all([
      this.client.upsert(COLLECTION, { points }),
      this.prisma.memory.upsert({
        where: { userId_key: { userId, key } },
        create: { userId, key, value, type },
        update: { value, type },
      }),
    ]);
  }

  async recall(userId: string, query: string, limit = 5): Promise<MemoryResult[]> {
    const [dense, sparse] = await Promise.all([
      this.embed(query),
      Promise.resolve(buildSparseVector(query)),
    ]);

    const userFilter = {
      must: [{ key: 'userId', match: { value: userId } }],
    };

    const candidateLimit = limit * CANDIDATE_MULTIPLIER;

    const response = await this.client.query(COLLECTION, {
      prefetch: [
        { query: dense, using: 'dense', limit: candidateLimit, filter: userFilter },
        { query: sparse, using: 'sparse', limit: candidateLimit, filter: userFilter },
      ],
      query: { fusion: 'rrf' },
      limit: limit * 2, // fetch extra for reranking headroom
      with_payload: true,
    } as any);

    const points: any[] = Array.isArray(response) ? response : (response as any).points ?? [];

    if (points.length === 0) return [];

    const candidates = points.map((p) => ({
      id: String(p.id),
      key: String(p.payload?.key ?? ''),
      value: String(p.payload?.value ?? ''),
      type: (p.payload?.type as MemoryType) ?? MemoryType.FACT,
      rrfScore: p.score as number,
    }));

    const reranked = await this.rerank(query, candidates, limit);
    return reranked;
  }

  async forget(userId: string, key: string): Promise<void> {
    await Promise.all([
      this.client.delete(COLLECTION, {
        filter: {
          must: [
            { key: 'userId', match: { value: userId } },
            { key: 'key', match: { value: key } },
          ],
        },
      }),
      this.prisma.memory.delete({ where: { userId_key: { userId, key } } }),
    ]);
  }

  async list(userId: string) {
    return this.prisma.memory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async rerank(
    query: string,
    candidates: { id: string; key: string; value: string; type: MemoryType; rrfScore: number }[],
    limit: number,
  ): Promise<MemoryResult[]> {
    if (candidates.length === 0) return [];

    const rerankerUrl = this.config.getOrThrow<string>('RERANK_URL');
    const model = this.config.getOrThrow<string>('RERANK_MODEL');

    try {
      const { data } = await firstValueFrom(
        this.httpService.post<{ data: { index: number; score: number }[] }>(
          `${rerankerUrl}/rerank`,
          {
            model,
            query,
            documents: candidates.map((c) => `${c.key}: ${c.value}`),
          },
        ),
      );

      return data.data
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((r) => {
          const c = candidates[r.index];
          return { id: c.id, key: c.key, value: c.value, type: c.type, score: r.score };
        });
    } catch (err) {
      this.logger.warn(`Reranker failed, using RRF scores: ${(err as Error).message}`);
      return candidates
        .sort((a, b) => b.rrfScore - a.rrfScore)
        .slice(0, limit)
        .map(({ id, key, value, type, rrfScore }) => ({ id, key, value, type, score: rrfScore }));
    }
  }

  private async embed(text: string): Promise<number[]> {
    const embedUrl = this.config.getOrThrow<string>('EMBED_URL');
    const model = this.config.getOrThrow<string>('EMBED_MODEL');

    const { data } = await firstValueFrom(
      this.httpService.post<{ data: { embedding: number[] }[] }>(
        `${embedUrl}/embeddings`,
        { model, input: text, truncate_prompt_tokens: 512 },
      ),
    );

    return data.data[0].embedding;
  }

  private async ensureCollection() {
    const collections = await this.client.getCollections();
    const existing = collections.collections.find((c) => c.name === COLLECTION);

    if (existing) {
      const info = await this.client.getCollection(COLLECTION);
      const hasNamedDense = !!(info.config?.params?.vectors as any)?.dense;
      if (!hasNamedDense) {
        this.logger.warn(
          `Collection "${COLLECTION}" uses legacy schema — recreating for hybrid search. ` +
          `Existing memories are cleared. The agent will rebuild memory over time.`,
        );
        await this.client.deleteCollection(COLLECTION);
        await this.createCollection();
      }
      return;
    }

    await this.createCollection();
  }

  private async createCollection() {
    await this.client.createCollection(COLLECTION, {
      vectors: {
        dense: { size: DENSE_SIZE, distance: 'Cosine' },
      },
      sparse_vectors: {
        sparse: { modifier: 'idf' },
      },
    } as any);
    this.logger.log(`Created collection "${COLLECTION}" with dense+sparse hybrid support`);
  }
}

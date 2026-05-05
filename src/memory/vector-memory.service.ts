import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { QdrantClient } from '@qdrant/js-client-rest';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { chunkText } from '../files/text-chunker';

const COLLECTION = 'user_memories';
const VECTOR_SIZE = 384;

export interface MemoryResult {
  id: string;
  key: string;
  value: string;
  score: number;
}

@Injectable()
export class VectorMemoryService implements OnModuleInit {
  private client: QdrantClient;

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {
    this.client = new QdrantClient({ url: config.getOrThrow('QDRANT_URL') });
  }

  async onModuleInit() {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION);
    if (!exists) {
      await this.client.createCollection(COLLECTION, {
        vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
      });
    }
  }

  async remember(userId: string, key: string, value: string): Promise<void> {
    const chunks = chunkText(value, 350);
    const points = await Promise.all(
      chunks.map(async (chunk) => ({
        id: randomUUID(),
        vector: await this.embed(chunk),
        payload: {
          userId,
          key,
          value: chunk.slice(0, 1000),
        },
      })),
    );

    await Promise.all([
      this.client.upsert(COLLECTION, { points }),
      this.prisma.memory.upsert({
        where: { userId_key: { userId, key } },
        create: { userId, key, value },
        update: { value },
      }),
    ]);
  }

  async recall(userId: string, query: string, limit = 5): Promise<MemoryResult[]> {
    const [vectorResults, bm25Results] = await Promise.all([
      this.vectorSearch(userId, query, limit * 2),
      this.bm25Search(userId, query, limit * 2),
    ]);

    const combined = this.combineResults(vectorResults, bm25Results);
    const reranked = await this.rerank(query, combined, limit);

    return reranked;
  }

  async forget(userId: string, key: string): Promise<void> {
    await this.client.delete(COLLECTION, {
      filter: { must: [{ key: 'userId', match: { value: userId } }, { key: 'key', match: { value: key } }] },
    });

    await this.prisma.memory.delete({
      where: { userId_key: { userId, key } },
    });
  }

  async list(userId: string) {
    return this.prisma.memory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async vectorSearch(userId: string, query: string, limit: number) {
    const vector = await this.embed(query);

    const results = await this.client.search(COLLECTION, {
      vector,
      limit,
      filter: { must: [{ key: 'userId', match: { value: userId } }] },
    });

    return results.map((r) => ({
      id: String(r.id),
      key: (r.payload?.key as string) || '',
      value: (r.payload?.value as string) || '',
      score: r.score,
      source: 'vector' as const,
    }));
  }

  private async bm25Search(userId: string, query: string, limit: number) {
    const results = await this.prisma.memory.findMany({
      where: {
        userId,
        OR: [{ key: { contains: query, mode: 'insensitive' } }, { value: { contains: query, mode: 'insensitive' } }],
      },
      take: limit,
    });

    return results.map((r, idx) => ({
      id: r.id,
      key: r.key,
      value: r.value,
      score: 1 - idx * 0.1,
      source: 'bm25' as const,
    }));
  }

  private combineResults(vectorResults: any[], bm25Results: any[]) {
    const map = new Map<string, any>();

    vectorResults.forEach((r) => {
      if (!map.has(r.key)) {
        map.set(r.key, { ...r, scores: { vector: r.score, bm25: 0 } });
      } else {
        map.get(r.key).scores.vector = r.score;
      }
    });

    bm25Results.forEach((r) => {
      if (!map.has(r.key)) {
        map.set(r.key, { ...r, scores: { vector: 0, bm25: r.score } });
      } else {
        map.get(r.key).scores.bm25 = r.score;
      }
    });

    return Array.from(map.values()).map((r) => ({
      id: r.id,
      key: r.key,
      value: r.value,
      combinedScore: r.scores.vector * 0.6 + r.scores.bm25 * 0.4,
    }));
  }

  private async rerank(query: string, candidates: any[], limit: number): Promise<MemoryResult[]> {
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

      const rerankedResults = data.data
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((r) => {
          const candidate = candidates[r.index];
          return {
            id: candidate.id,
            key: candidate.key,
            value: candidate.value,
            score: r.score,
          };
        });

      return rerankedResults;
    } catch (error) {
      console.warn('Reranker failed, falling back to combined score:', error);
      return candidates.sort((a, b) => b.combinedScore - a.combinedScore).slice(0, limit);
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
}

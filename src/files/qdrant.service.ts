import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { QdrantClient } from '@qdrant/js-client-rest';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import { chunkText } from './text-chunker';
import { buildSparseVector } from './sparse-encoder';

const COLLECTION = 'user_files';
const DENSE_SIZE = 384;
const CANDIDATE_MULTIPLIER = 3; // prefetch N×limit per leg before RRF fusion

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.client = new QdrantClient({ url: config.getOrThrow('QDRANT_URL') });
  }

  async onModuleInit() {
    await this.ensureCollection();
  }

  async upsert(
    userId: string,
    fileId: string,
    filename: string,
    text: string,
    sessionId?: string,
  ): Promise<string> {
    const chunks = chunkText(text, 300, 48);
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
            fileId,
            filename,
            sessionId: sessionId ?? null,
            text: chunk.slice(0, 600),
          },
        };
      }),
    );

    await this.client.upsert(COLLECTION, { points });
    return points[0].id;
  }

  async search(
    userId: string,
    query: string,
    limit = 5,
    sessionId?: string,
  ) {
    const [dense, sparse] = await Promise.all([
      this.embed(query),
      Promise.resolve(buildSparseVector(query)),
    ]);

    const userFilter = {
      must: [
        { key: 'userId', match: { value: userId } },
        ...(sessionId ? [{ key: 'sessionId', match: { value: sessionId } }] : []),
      ],
    };

    const candidateLimit = limit * CANDIDATE_MULTIPLIER;

    const response = await this.client.query(COLLECTION, {
      prefetch: [
        {
          query: dense,
          using: 'dense',
          limit: candidateLimit,
          filter: userFilter,
        },
        {
          query: sparse,
          using: 'sparse',
          limit: candidateLimit,
          filter: userFilter,
        },
      ],
      query: { fusion: 'rrf' },
      limit,
      with_payload: true,
    } as any);

    // The JS REST client wraps the result — handle both shapes
    const points: any[] = Array.isArray(response) ? response : (response as any).points ?? [];
    return points;
  }

  async deleteByFileId(fileId: string) {
    await this.client.delete(COLLECTION, {
      filter: { must: [{ key: 'fileId', match: { value: fileId } }] },
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async ensureCollection() {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION);
    if (!exists) {
      await this.createCollection();
    }
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

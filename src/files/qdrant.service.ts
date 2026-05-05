import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { QdrantClient } from '@qdrant/js-client-rest';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import { chunkText } from './text-chunker';

const COLLECTION = 'user_files';
const VECTOR_SIZE = 384;

@Injectable()
export class QdrantService implements OnModuleInit {
  private client: QdrantClient;

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
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

  async upsert(
    userId: string,
    fileId: string,
    filename: string,
    text: string,
    sessionId?: string,
  ): Promise<string> {
    const chunks = chunkText(text, 350);
    const points = await Promise.all(
      chunks.map(async (chunk) => ({
        id: randomUUID(),
        vector: await this.embed(chunk),
        payload: { userId, fileId, filename, sessionId, text: chunk.slice(0, 500) },
      })),
    );

    await this.client.upsert(COLLECTION, { points });
    return points[0].id;
  }

  async search(userId: string, query: string, limit = 5) {
    const vector = await this.embed(query);

    return this.client.search(COLLECTION, {
      vector,
      limit,
      filter: { must: [{ key: 'userId', match: { value: userId } }] },
    });
  }

  async deleteByFileId(fileId: string) {
    await this.client.delete(COLLECTION, {
      filter: { must: [{ key: 'fileId', match: { value: fileId } }] },
    });
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

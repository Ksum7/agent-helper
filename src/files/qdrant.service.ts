import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { QdrantClient } from '@qdrant/js-client-rest';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';

const COLLECTION = 'user_files';
const VECTOR_SIZE = 768;

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

  async upsert(userId: string, fileId: string, text: string): Promise<string> {
    const vector = await this.embed(text);
    const pointId = randomUUID();

    await this.client.upsert(COLLECTION, {
      points: [
        {
          id: pointId,
          vector,
          payload: { userId, fileId, text: text.slice(0, 500) },
        },
      ],
    });

    return pointId;
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
    const ollamaUrl = this.config.getOrThrow<string>('OLLAMA_URL');
    const model = this.config.get('EMBED_MODEL', 'nomic-embed-text');

    const { data } = await firstValueFrom(
      this.httpService.post<{ embedding: number[] }>(
        `${ollamaUrl}/api/embeddings`,
        {
          model,
          prompt: text,
        },
      ),
    );

    return data.embedding;
  }
}

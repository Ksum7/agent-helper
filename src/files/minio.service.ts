import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { Readable } from 'stream';

@Injectable()
export class MinioService implements OnModuleInit {
  private client: MinioClient;
  private bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.getOrThrow('MINIO_BUCKET');
    this.client = new MinioClient({
      endPoint: config.getOrThrow('MINIO_ENDPOINT'),
      port: config.get('MINIO_PORT', 9000),
      useSSL: config.get('NODE_ENV') === 'production',
      accessKey: config.getOrThrow('MINIO_ACCESS_KEY'),
      secretKey: config.getOrThrow('MINIO_SECRET_KEY'),
    });
  }

  async onModuleInit() {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) await this.client.makeBucket(this.bucket);
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    return key;
  }

  getStream(key: string): Promise<Readable> {
    return this.client.getObject(this.bucket, key);
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
}

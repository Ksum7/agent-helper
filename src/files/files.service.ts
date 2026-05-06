import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from './minio.service';
import { QdrantService } from './qdrant.service';
import { TextExtractorService } from './text-extractor.service';
import { LlmService } from '../llm/llm.service';
import { randomUUID } from 'crypto';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly qdrant: QdrantService,
    private readonly textExtractor: TextExtractorService,
    private readonly llm: LlmService,
  ) {}

  async upload(userId: string, file: Express.Multer.File, sessionId?: string) {
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const key = `${userId}/${randomUUID()}-${originalname}`;
    await this.minio.upload(key, file.buffer, file.mimetype);

    const record = await this.prisma.fileRecord.create({
      data: { userId, filename: originalname, mimeType: file.mimetype, minioKey: key, sessionId },
    });

    if (!this.textExtractor.isSupported(file.mimetype)) return record;

    const text = await this.textExtractor.extract(file);

    // Summarization + vectorization run in parallel — they're independent
    const [summary, qdrantId] = await Promise.all([
      this.generateSummary(text, originalname),
      this.qdrant.upsert(userId, record.id, originalname, text, sessionId),
    ]);

    await this.prisma.fileRecord.update({
      where: { id: record.id },
      data: { qdrantId, summary },
    });

    return { ...record, qdrantId, summary };
  }

  async getStream(userId: string, fileId: string) {
    const record = await this.prisma.fileRecord.findFirst({ where: { id: fileId, userId } });
    if (!record) throw new NotFoundException('File not found');
    return { record, stream: await this.minio.getStream(record.minioKey) };
  }

  async list(userId: string) {
    return this.prisma.fileRecord.findMany({
      where: { userId },
      select: { id: true, filename: true, mimeType: true, summary: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(userId: string, fileId: string) {
    const record = await this.prisma.fileRecord.findFirst({ where: { id: fileId, userId } });
    if (!record) throw new NotFoundException('File not found');

    await this.minio.delete(record.minioKey);
    if (record.qdrantId) await this.qdrant.deleteByFileId(record.id);
    await this.prisma.fileRecord.delete({ where: { id: fileId } });
  }

  // ---------------------------------------------------------------------------

  private async generateSummary(text: string, filename: string): Promise<string | null> {
    try {
      return await this.llm.summarize(text, 150);
    } catch (err) {
      this.logger.warn(`Summary generation failed for "${filename}": ${(err as Error).message}`);
      return null;
    }
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from './minio.service';
import { QdrantService } from './qdrant.service';
import { TextExtractorService } from './text-extractor.service';
import { randomUUID } from 'crypto';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly qdrant: QdrantService,
    private readonly textExtractor: TextExtractorService,
  ) {}

  async upload(userId: string, file: Express.Multer.File, sessionId?: string) {
    const key = `${userId}/${randomUUID()}-${file.originalname}`;
    await this.minio.upload(key, file.buffer, file.mimetype);

    const record = await this.prisma.fileRecord.create({
      data: {
        userId,
        filename: file.originalname,
        mimeType: file.mimetype,
        minioKey: key,
        qdrantId: null,
        sessionId,
      },
    });

    let qdrantId: string | undefined;
    if (this.textExtractor.isSupported(file.mimetype)) {
      const text = await this.textExtractor.extract(file);
      qdrantId = await this.qdrant.upsert(userId, record.id, text, sessionId);
      await this.prisma.fileRecord.update({
        where: { id: record.id },
        data: { qdrantId },
      });
    }

    return record;
  }

  async getStream(userId: string, fileId: string) {
    const record = await this.prisma.fileRecord.findFirst({
      where: { id: fileId, userId },
    });
    if (!record) throw new NotFoundException('File not found');
    return { record, stream: await this.minio.getStream(record.minioKey) };
  }

  async list(userId: string) {
    return this.prisma.fileRecord.findMany({
      where: { userId },
      select: { id: true, filename: true, mimeType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(userId: string, fileId: string) {
    const record = await this.prisma.fileRecord.findFirst({
      where: { id: fileId, userId },
    });
    if (!record) throw new NotFoundException('File not found');

    await this.minio.delete(record.minioKey);
    if (record.qdrantId) await this.qdrant.deleteByFileId(record.id);
    await this.prisma.fileRecord.delete({ where: { id: fileId } });
  }
}

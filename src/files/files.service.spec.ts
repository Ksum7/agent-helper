import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from './minio.service';
import { QdrantService } from './qdrant.service';
import { TextExtractorService } from './text-extractor.service';

const mockFile = {
  originalname: 'test.pdf',
  mimetype: 'application/pdf',
  buffer: Buffer.from('test'),
  size: 4,
} as Express.Multer.File;

describe('FilesService', () => {
  let service: FilesService;
  let prisma: any;
  let minio: any;
  let qdrant: any;
  let textExtractor: any;

  beforeEach(async () => {
    prisma = {
      fileRecord: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    minio = {
      upload: jest.fn(),
      getStream: jest.fn(),
      delete: jest.fn(),
    };

    qdrant = {
      upsert: jest.fn(),
      deleteByFileId: jest.fn(),
    };

    textExtractor = {
      isSupported: jest.fn(),
      extract: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MinioService, useValue: minio },
        { provide: QdrantService, useValue: qdrant },
        { provide: TextExtractorService, useValue: textExtractor },
      ],
    }).compile();

    service = module.get(FilesService);
  });

  describe('upload', () => {
    it('uploads file to minio, creates DB record, and upserts to qdrant when supported', async () => {
      textExtractor.isSupported.mockReturnValue(true);
      minio.upload.mockResolvedValue(undefined);
      prisma.fileRecord.create.mockResolvedValue({
        id: 'file-1',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        minioKey: 'user-1/uuid-test.pdf',
        qdrantId: null,
        userId: 'user-1',
        sessionId: null,
        createdAt: new Date(),
      } as any);

      textExtractor.extract.mockResolvedValue('extracted text');
      qdrant.upsert.mockResolvedValue('qdrant-id-1');
      prisma.fileRecord.update.mockResolvedValue({
        id: 'file-1',
        qdrantId: 'qdrant-id-1',
      } as any);

      const result = await service.upload('user-1', mockFile, 'session-1');

      expect(minio.upload).toHaveBeenCalled();
      expect(prisma.fileRecord.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          minioKey: expect.stringContaining('user-1/'),
          qdrantId: null,
          sessionId: 'session-1',
        },
      });

      expect(textExtractor.extract).toHaveBeenCalledWith(mockFile);
      expect(qdrant.upsert).toHaveBeenCalledWith(
        'user-1',
        'file-1',
        'extracted text',
        'session-1',
      );
      expect(prisma.fileRecord.update).toHaveBeenCalledWith({
        where: { id: 'file-1' },
        data: { qdrantId: 'qdrant-id-1' },
      });
    });

    it('skips qdrant upsert when mime type not supported', async () => {
      textExtractor.isSupported.mockReturnValue(false);
      minio.upload.mockResolvedValue(undefined);
      prisma.fileRecord.create.mockResolvedValue({
        id: 'file-1',
        filename: 'image.png',
        mimeType: 'image/png',
        minioKey: 'user-1/uuid-image.png',
        qdrantId: null,
        userId: 'user-1',
        sessionId: null,
        createdAt: new Date(),
      } as any);

      const result = await service.upload('user-1', mockFile);

      expect(minio.upload).toHaveBeenCalled();
      expect(textExtractor.extract).not.toHaveBeenCalled();
      expect(qdrant.upsert).not.toHaveBeenCalled();
      expect(prisma.fileRecord.update).not.toHaveBeenCalled();
    });
  });

  describe('getStream', () => {
    it('returns record and stream when file exists', async () => {
      const record = {
        id: 'file-1',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        minioKey: 'key',
        userId: 'user-1',
      };
      const mockStream = { pipe: jest.fn() };

      prisma.fileRecord.findFirst.mockResolvedValue(record as any);
      minio.getStream.mockResolvedValue(mockStream as any);

      const result = await service.getStream('user-1', 'file-1');

      expect(prisma.fileRecord.findFirst).toHaveBeenCalledWith({
        where: { id: 'file-1', userId: 'user-1' },
      });
      expect(minio.getStream).toHaveBeenCalledWith('key');
      expect(result).toEqual({ record, stream: mockStream });
    });

    it('throws NotFoundException when file not found', async () => {
      prisma.fileRecord.findFirst.mockResolvedValue(null);

      await expect(service.getStream('user-1', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('returns list of user files ordered by creation date', async () => {
      const files = [
        {
          id: '1',
          filename: 'a.pdf',
          mimeType: 'application/pdf',
          createdAt: new Date('2025-01-02'),
        },
        {
          id: '2',
          filename: 'b.txt',
          mimeType: 'text/plain',
          createdAt: new Date('2025-01-01'),
        },
      ];
      prisma.fileRecord.findMany.mockResolvedValue(files as any);

      const result = await service.list('user-1');

      expect(prisma.fileRecord.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { id: true, filename: true, mimeType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(files);
    });
  });

  describe('delete', () => {
    it('deletes file from minio and qdrant when qdrantId exists', async () => {
      const record = {
        id: 'file-1',
        minioKey: 'key',
        qdrantId: 'qdrant-id',
      };
      prisma.fileRecord.findFirst.mockResolvedValue(record as any);
      minio.delete.mockResolvedValue(undefined);
      qdrant.deleteByFileId.mockResolvedValue(undefined);
      prisma.fileRecord.delete.mockResolvedValue(record as any);

      await service.delete('user-1', 'file-1');

      expect(prisma.fileRecord.findFirst).toHaveBeenCalledWith({
        where: { id: 'file-1', userId: 'user-1' },
      });
      expect(minio.delete).toHaveBeenCalledWith('key');
      expect(qdrant.deleteByFileId).toHaveBeenCalledWith('file-1');
      expect(prisma.fileRecord.delete).toHaveBeenCalledWith({ where: { id: 'file-1' } });
    });

    it('skips qdrant deletion when qdrantId is null', async () => {
      const record = {
        id: 'file-1',
        minioKey: 'key',
        qdrantId: null,
      };
      prisma.fileRecord.findFirst.mockResolvedValue(record as any);
      minio.delete.mockResolvedValue(undefined);
      prisma.fileRecord.delete.mockResolvedValue(record as any);

      await service.delete('user-1', 'file-1');

      expect(minio.delete).toHaveBeenCalled();
      expect(qdrant.deleteByFileId).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when file not found', async () => {
      prisma.fileRecord.findFirst.mockResolvedValue(null);

      await expect(service.delete('user-1', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});

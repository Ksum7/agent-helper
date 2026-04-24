import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { AuthGuard } from '../auth/auth.guard';
import { Response } from 'express';
import { Readable } from 'stream';

const mockUser = { sub: 'user-1' };

const mockFile = {
  originalname: 'test.txt',
  mimetype: 'text/plain',
  buffer: Buffer.from('hello'),
  size: 5,
} as Express.Multer.File;

describe('FilesController', () => {
  let controller: FilesController;
  let filesService: jest.Mocked<FilesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        {
          provide: FilesService,
          useValue: {
            upload: jest.fn(),
            list: jest.fn(),
            getStream: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(FilesController);
    filesService = module.get(FilesService);
  });

  describe('POST /files', () => {
    it('uploads file with sessionId', async () => {
      const record = {
        id: '1',
        sessionId: 'session-1',
        filename: 'test.txt',
        mimeType: 'text/plain',
        userId: 'user-1',
        minioKey: 'key1',
        qdrantId: null,
        createdAt: new Date(),
      };
      filesService.upload.mockResolvedValue(record as any);

      const result = await controller.upload(mockUser, mockFile, 'session-1');

      expect(filesService.upload).toHaveBeenCalledWith('user-1', mockFile, 'session-1');
      expect(result).toEqual(record);
    });

    it('uploads file without sessionId', async () => {
      const record = {
        id: '1',
        sessionId: null,
        filename: 'test.txt',
        mimeType: 'text/plain',
        userId: 'user-1',
        minioKey: 'key1',
        qdrantId: null,
        createdAt: new Date(),
      };
      filesService.upload.mockResolvedValue(record as any);

      const result = await controller.upload(mockUser, mockFile);

      expect(filesService.upload).toHaveBeenCalledWith('user-1', mockFile, undefined);
      expect(result).toEqual(record);
    });
  });

  describe('GET /files', () => {
    it('returns list of files for the user', async () => {
      const files = [
        {
          id: '1',
          sessionId: null,
          filename: 'test.txt',
          mimeType: 'text/plain',
          userId: 'user-1',
          minioKey: 'key1',
          qdrantId: null,
          createdAt: new Date(),
        },
      ];
      filesService.list.mockResolvedValue(files as any);

      const result = await controller.list(mockUser);

      expect(filesService.list).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(files);
    });
  });

  describe('GET /files/:id', () => {
    it('streams file with correct headers', async () => {
      const stream = Readable.from(['hello']);
      const record = {
        id: '1',
        sessionId: null,
        filename: 'test.txt',
        mimeType: 'text/plain',
        minioKey: 'k',
        qdrantId: null,
        userId: 'user-1',
        createdAt: new Date(),
      };
      filesService.getStream.mockResolvedValue({ record, stream });

      const res = {
        setHeader: jest.fn(),
        pipe: jest.fn(),
      } as unknown as Response;
      (stream as any).pipe = jest.fn();

      await controller.download(mockUser, '1', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="test.txt"',
      );
    });

    it('throws NotFoundException when file not found', async () => {
      filesService.getStream.mockRejectedValue(new NotFoundException());

      await expect(
        controller.download(mockUser, 'bad-id', {} as Response),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('DELETE /files/:id', () => {
    it('deletes file', async () => {
      filesService.delete.mockResolvedValue(undefined);

      await controller.delete(mockUser, '1');

      expect(filesService.delete).toHaveBeenCalledWith('user-1', '1');
    });
  });
});

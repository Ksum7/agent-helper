import { BadRequestException } from '@nestjs/common';
import { TextExtractorService } from './text-extractor.service';

describe('TextExtractorService', () => {
  let service: TextExtractorService;

  beforeEach(() => {
    service = new TextExtractorService();
  });

  describe('isSupported', () => {
    it('returns true for all supported MIME types', () => {
      expect(service.isSupported('text/plain')).toBe(true);
      expect(service.isSupported('text/markdown')).toBe(true);
      expect(service.isSupported('application/pdf')).toBe(true);
      expect(service.isSupported('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(
        true,
      );
      expect(service.isSupported('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
      expect(service.isSupported('application/vnd.ms-excel')).toBe(true);
    });

    it('returns false for unsupported MIME types', () => {
      expect(service.isSupported('image/png')).toBe(false);
      expect(service.isSupported('video/mp4')).toBe(false);
      expect(service.isSupported('application/zip')).toBe(false);
      expect(service.isSupported('audio/mpeg')).toBe(false);
    });
  });

  describe('getSupportedTypesMessage', () => {
    it('returns message with all supported types', () => {
      const message = service.getSupportedTypesMessage();

      expect(message).toContain('Supported file types');
      expect(message).toContain('PDF');
      expect(message).toContain('DOCX');
      expect(message).toContain('XLSX');
      expect(message).toContain('TXT');
      expect(message).toContain('MD');
    });
  });

  describe('extract', () => {
    it('extracts plain text from text/plain files', async () => {
      const file = {
        originalname: 'test.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from('Hello world'),
      } as Express.Multer.File;

      const result = await service.extract(file);

      expect(result).toBe('Hello world');
    });

    it('extracts markdown from text/markdown files', async () => {
      const file = {
        originalname: 'test.md',
        mimetype: 'text/markdown',
        buffer: Buffer.from('# Hello\n\nThis is markdown'),
      } as Express.Multer.File;

      const result = await service.extract(file);

      expect(result).toBe('# Hello\n\nThis is markdown');
    });

    it('throws BadRequestException for unsupported MIME type', async () => {
      const file = {
        originalname: 'image.png',
        mimetype: 'image/png',
        buffer: Buffer.from('fake image'),
      } as Express.Multer.File;

      await expect(service.extract(file)).rejects.toThrow(BadRequestException);
    });
  });
});

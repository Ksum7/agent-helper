import { Injectable, BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import { Workbook } from 'exceljs';

const SUPPORTED_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

@Injectable()
export class TextExtractorService {
  isSupported(mimeType: string): boolean {
    return SUPPORTED_TYPES.includes(mimeType);
  }

  getSupportedTypesMessage(): string {
    return `Supported file types: PDF, DOCX, XLSX, XLS, TXT, MD`;
  }

  async extract(file: Express.Multer.File): Promise<string> {
    if (!this.isSupported(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not supported. ${this.getSupportedTypesMessage()}`,
      );
    }

    switch (file.mimetype) {
      case 'text/plain':
      case 'text/markdown':
        return file.buffer.toString('utf-8');

      case 'application/pdf':
        return await this.extractFromPdf(file.buffer);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await this.extractFromDocx(file.buffer);

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        return await this.extractFromExcel(file.buffer);

      default:
        throw new BadRequestException(
          `Cannot extract text from "${file.mimetype}"`,
        );
    }
  }

  private async extractFromPdf(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return result.text;
    } catch (error) {
      throw new BadRequestException(
        `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async extractFromDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new BadRequestException(
        `Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async extractFromExcel(buffer: Buffer): Promise<string> {
    try {
      const workbook = new Workbook();
      await workbook.xlsx.load(buffer as any);

      const texts: string[] = [];

      workbook.eachSheet((worksheet: any) => {
        texts.push(`[Sheet: ${worksheet.name}]`);

        worksheet.eachRow((row: any) => {
          const rowValues = row.values
            ?.map((cell: any) => (cell ? String(cell) : ''))
            .join('\t');
          if (rowValues) {
            texts.push(rowValues);
          }
        });

        texts.push('');
      });

      return texts.join('\n');
    } catch (error) {
      throw new BadRequestException(
        `Failed to parse Excel: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

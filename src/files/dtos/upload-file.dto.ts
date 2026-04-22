import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UploadFileSchema = z.object({
  description: z.string().optional(),
});

export class UploadFileDto extends createZodDto(UploadFileSchema) {}

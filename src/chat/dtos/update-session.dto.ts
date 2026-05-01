import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class UpdateSessionDto extends createZodDto(
  z.object({
    title: z.string().min(1).max(255),
  }),
) {}

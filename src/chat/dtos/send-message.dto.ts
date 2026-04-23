import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class SendMessageDto extends createZodDto(
  z.object({
    content: z.string().min(1),
  }),
) {}

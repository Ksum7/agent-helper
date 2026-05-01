import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';
import { CreateSessionDto } from './dtos/create-session.dto';
import { SendMessageDto } from './dtos/send-message.dto';
import { UpdateSessionDto } from './dtos/update-session.dto';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
  ) {}

  @Post('sessions')
  createSession(@User() user: { sub: string }, @Body() dto: CreateSessionDto) {
    return this.prisma.chatSession.create({
      data: { userId: user.sub, title: dto.title },
    });
  }

  @Get('sessions')
  getSessions(@User() user: { sub: string }) {
    return this.prisma.chatSession.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string, @User() user: { sub: string }) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id, userId: user.sub },
    });
    if (!session) throw new NotFoundException();
    return session;
  }

  @Patch('sessions/:id')
  async updateSession(
    @Param('id') id: string,
    @User() user: { sub: string },
    @Body() dto: UpdateSessionDto,
  ) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id, userId: user.sub },
    });
    if (!session) throw new NotFoundException();
    return this.prisma.chatSession.update({
      where: { id },
      data: { title: dto.title },
    });
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(@Param('id') id: string, @User() user: { sub: string }) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id, userId: user.sub },
    });
    if (!session) throw new NotFoundException();

    await this.prisma.message.deleteMany({
      where: { sessionId: id, userId: user.sub },
    });
    await this.prisma.chatSession.delete({ where: { id } });
  }

  @Get('sessions/:id/messages')
  async getMessages(@Param('id') id: string, @User() user: { sub: string }) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id, userId: user.sub },
    });
    if (!session) throw new NotFoundException();

    return this.prisma.message.findMany({
      where: { sessionId: id, userId: user.sub },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post('sessions/:id/messages')
  async sendMessage(
    @Param('id') sessionId: string,
    @Body() dto: SendMessageDto,
    @User() user: { sub: string },
    @Res() res: Response,
  ) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId: user.sub },
    });
    if (!session) throw new NotFoundException();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const chunk of this.chatService.stream(
        user.sub,
        sessionId,
        dto.content,
      )) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (error) {
      this.logger.error('Stream error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      res.write(
        `data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`,
      );
    } finally {
      res.end();
    }
  }
}

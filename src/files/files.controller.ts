import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { FilesService } from './files.service';

@Controller('files')
@UseGuards(AuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @User() user: { sub: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.upload(user.sub, file);
  }

  @Get()
  list(@User() user: { sub: string }) {
    return this.filesService.list(user.sub);
  }

  @Get(':id')
  async download(
    @User() user: { sub: string },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { record, stream } = await this.filesService.getStream(user.sub, id);
    res.setHeader('Content-Type', record.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${record.filename}"`,
    );
    stream.pipe(res);
  }

  @Delete(':id')
  delete(@User() user: { sub: string }, @Param('id') id: string) {
    return this.filesService.delete(user.sub, id);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { User } from './decorators/user.decorator';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res() res: Response) {
    const { token } = await this.authService.register(dto);
    res.cookie('token', token, COOKIE_OPTIONS).json({ ok: true });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    const { token } = await this.authService.login(dto);
    res.cookie('token', token, COOKIE_OPTIONS).json({ ok: true });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res() res: Response) {
    res.clearCookie('token').json({ ok: true });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@User() user: { sub: string }) {
    return this.authService.me(user.sub);
  }
}

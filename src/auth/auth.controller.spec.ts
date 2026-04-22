import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Response } from 'express';

const mockRes = () => {
  const res = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;
  (res.cookie as jest.Mock).mockReturnValue(res);
  (res.clearCookie as jest.Mock).mockReturnValue(res);
  return res;
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            me: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  describe('POST /auth/register', () => {
    it('sets jwt cookie and returns ok on success', async () => {
      authService.register.mockResolvedValue({ token: 'jwt-token' });
      const res = mockRes();

      await controller.register(
        { email: 'a@b.com', password: 'password123' },
        res,
      );

      expect(authService.register).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'password123',
      });
      expect(res.cookie).toHaveBeenCalledWith(
        'token',
        'jwt-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it('propagates ConflictException when email already exists', async () => {
      authService.register.mockRejectedValue(new ConflictException());

      await expect(
        controller.register(
          { email: 'a@b.com', password: 'password123' },
          mockRes(),
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('POST /auth/login', () => {
    it('sets jwt cookie and returns ok on success', async () => {
      authService.login.mockResolvedValue({ token: 'jwt-token' });
      const res = mockRes();

      await controller.login(
        { email: 'a@b.com', password: 'password123' },
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'token',
        'jwt-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it('propagates UnauthorizedException on wrong credentials', async () => {
      authService.login.mockRejectedValue(new UnauthorizedException());

      await expect(
        controller.login({ email: 'a@b.com', password: 'wrong' }, mockRes()),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears cookie and returns ok', () => {
      const res = mockRes();
      controller.logout(res);

      expect(res.clearCookie).toHaveBeenCalledWith('token');
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe('GET /auth/me', () => {
    it('returns user profile', async () => {
      const profile = { id: '1', email: 'a@b.com', createdAt: new Date() };
      authService.me.mockResolvedValue(profile);

      const result = await controller.me({ sub: '1' });

      expect(authService.me).toHaveBeenCalledWith('1');
      expect(result).toEqual(profile);
    });
  });
});

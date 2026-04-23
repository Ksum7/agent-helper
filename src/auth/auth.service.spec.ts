import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt');
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockImplementation(() =>
        Promise.resolve({ id: '1', email: 'a@b.com' }),
      );

      await expect(
        service.register({ email: 'a@b.com', password: 'pass' }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes password, creates user, and returns JWT token', async () => {
      prisma.user.findUnique.mockImplementation(() => Promise.resolve(null));
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockImplementation(() =>
        Promise.resolve({
          id: 'user-1',
          email: 'a@b.com',
          password: 'hashed-password',
        }),
      );
      jwtService.sign.mockReturnValue('jwt-token');

      const result = await service.register({ email: 'a@b.com', password: 'pass123' });

      expect(bcrypt.hash).toHaveBeenCalledWith('pass123', 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: 'a@b.com', password: 'hashed-password' },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'a@b.com',
      });
      expect(result).toEqual({ token: 'jwt-token' });
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockImplementation(() => Promise.resolve(null));

      await expect(
        service.login({ email: 'a@b.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      prisma.user.findUnique.mockImplementation(() =>
        Promise.resolve({
          id: 'user-1',
          email: 'a@b.com',
          password: 'hashed',
        }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns JWT token on success', async () => {
      prisma.user.findUnique.mockImplementation(() =>
        Promise.resolve({
          id: 'user-1',
          email: 'a@b.com',
          password: 'hashed',
        }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login({ email: 'a@b.com', password: 'pass123' });

      expect(bcrypt.compare).toHaveBeenCalledWith('pass123', 'hashed');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'a@b.com',
      });
      expect(result).toEqual({ token: 'jwt-token' });
    });
  });

  describe('me', () => {
    it('returns user profile', async () => {
      const user = {
        id: 'user-1',
        email: 'a@b.com',
        createdAt: new Date(),
      };
      prisma.user.findUniqueOrThrow.mockImplementation(() => Promise.resolve(user));

      const result = await service.me('user-1');

      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { id: true, email: true, createdAt: true },
      });
      expect(result).toEqual(user);
    });

    it('throws when user not found', async () => {
      prisma.user.findUniqueOrThrow.mockImplementation(() => Promise.reject(new Error()));

      await expect(service.me('bad-id')).rejects.toThrow();
    });
  });
});

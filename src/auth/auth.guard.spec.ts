import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    jwtService = {
      verify: jest.fn(),
    } as any;
    guard = new AuthGuard(jwtService);
  });

  const mockExecutionContext = (cookieValue?: string) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        cookies: cookieValue ? { token: cookieValue } : {},
      }),
    }),
  });

  describe('canActivate', () => {
    it('throws UnauthorizedException when no token cookie', () => {
      const ctx = mockExecutionContext(undefined);

      expect(() => guard.canActivate(ctx as any)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when JWT verify fails', () => {
      const ctx = mockExecutionContext('bad-token');
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => guard.canActivate(ctx as any)).toThrow(UnauthorizedException);
    });

    it('sets request.user and returns true on valid token', () => {
      const payload = { sub: 'user-1', email: 'a@b.com' };
      jwtService.verify.mockReturnValue(payload);

      const request = {} as any;
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({
            ...request,
            cookies: { token: 'valid-token' },
          }),
        }),
      };

      const result = guard.canActivate(ctx as any);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(result).toBe(true);
    });
  });
});

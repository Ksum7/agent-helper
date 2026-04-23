import { JwtService } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { Socket } from 'socket.io';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let jwtService: jest.Mocked<JwtService>;
  let chatService: jest.Mocked<ChatService>;

  beforeEach(() => {
    jwtService = {
      verify: jest.fn(),
    } as any;

    chatService = {
      stream: jest.fn(),
    } as any;

    gateway = new ChatGateway(jwtService, chatService);
  });

  const mockSocket = (token?: string, cookie?: string) => {
    const socket = {
      handshake: {
        auth: token ? { token } : {},
        headers: cookie ? { cookie } : {},
      },
      data: {},
      disconnect: jest.fn(),
      emit: jest.fn(),
    } as unknown as Socket;
    return socket;
  };

  describe('handleConnection', () => {
    it('disconnects when no token in auth or cookie', () => {
      const socket = mockSocket();
      gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects when token in cookie but JWT verify fails', () => {
      const socket = mockSocket(undefined, 'token=invalid');
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid');
      });

      gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('sets user data on valid token from auth', () => {
      const socket = mockSocket('valid-token');
      const payload = { sub: 'user-1' };
      jwtService.verify.mockReturnValue(payload);

      gateway.handleConnection(socket);

      expect((socket.data as any).user).toEqual(payload);
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('extracts token from cookie header', () => {
      const socket = mockSocket(undefined, 'session=abc; token=valid-token; path=/');
      const payload = { sub: 'user-1' };
      jwtService.verify.mockReturnValue(payload);

      gateway.handleConnection(socket);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
      expect((socket.data as any).user).toEqual(payload);
    });
  });

  describe('handleDisconnect', () => {
    it('nulls user data on disconnect', () => {
      const socket = mockSocket() as any;
      socket.data.user = { sub: 'user-1' };

      gateway.handleDisconnect(socket);

      expect(socket.data.user).toBeNull();
    });
  });

  describe('handleMessage', () => {
    it('emits chunk events for each yielded string and done event at end', async () => {
      const socket = mockSocket('valid-token') as any;
      socket.data.user = { sub: 'user-1' };

      async function* mockStream() {
        yield 'Hello ';
        yield 'world';
      }
      chatService.stream.mockReturnValue(mockStream());

      await gateway.handleMessage(socket, { sessionId: 'session-1', content: 'hi' });

      expect(chatService.stream).toHaveBeenCalledWith('user-1', 'session-1', 'hi');
      expect(socket.emit).toHaveBeenCalledWith('chunk', 'Hello ');
      expect(socket.emit).toHaveBeenCalledWith('chunk', 'world');
      expect(socket.emit).toHaveBeenCalledWith('done');
    });

    it('emits all chunks before done', async () => {
      const socket = mockSocket('valid-token') as any;
      socket.data.user = { sub: 'user-1' };

      async function* mockStream() {
        yield '1';
        yield '2';
        yield '3';
      }
      chatService.stream.mockReturnValue(mockStream());

      await gateway.handleMessage(socket, { sessionId: 'session-1', content: 'test' });

      const calls = (socket.emit as jest.Mock).mock.calls;
      const chunkCalls = calls.filter((c) => c[0] === 'chunk');
      const doneCalls = calls.filter((c) => c[0] === 'done');

      expect(chunkCalls).toHaveLength(3);
      expect(doneCalls).toHaveLength(1);

      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe('done');
    });
  });
});

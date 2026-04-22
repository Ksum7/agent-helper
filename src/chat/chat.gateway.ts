import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*', credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth['token'] as string | undefined) ??
        client.handshake.headers.cookie
          ?.split(';')
          .find((c) => c.trim().startsWith('token='))
          ?.split('=')[1];

      if (!token) throw new Error('No token');

      client.data.user = this.jwtService.verify(token);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    client.data.user = null;
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; content: string },
  ) {
    const userId = client.data.user?.sub as string;

    for await (const chunk of this.chatService.stream(
      userId,
      data.sessionId,
      data.content,
    )) {
      client.emit('chunk', chunk);
    }

    client.emit('done');
  }
}

import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { AuthModule } from '../auth/auth.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [AuthModule, AgentModule],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}

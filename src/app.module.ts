import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { AgentModule } from './agent/agent.module';
import { FilesModule } from './files/files.module';
import { MemoryModule } from './memory/memory.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ChatModule,
    AgentModule,
    FilesModule,
    MemoryModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AgentService } from './agent.service';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [HttpModule, MemoryModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}

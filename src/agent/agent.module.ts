import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AgentService } from './agent.service';
import { MemoryModule } from '../memory/memory.module';
import { LlmModule } from '../llm/llm.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [HttpModule, MemoryModule, LlmModule, FilesModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}

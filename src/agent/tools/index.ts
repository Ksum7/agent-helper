import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { StructuredTool } from '@langchain/core/tools';
import { MemoryService } from '../../memory/memory.service';
import { searchWebTool } from './search-web.tool';
import { browseUrlTool } from './browse-url.tool';
import { searchUserFilesTool } from './search-user-files.tool';
import { memoryTools } from './memory.tool';

export function buildTools(
  userId: string,
  sessionId: string,
  httpService: HttpService,
  config: ConfigService,
  memoryService: MemoryService,
): StructuredTool[] {
  return [
    searchUserFilesTool(userId, sessionId, config, httpService),
    searchWebTool(httpService, config),
    browseUrlTool(httpService),
    ...memoryTools(userId, memoryService),
  ];
}

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { StructuredTool } from '@langchain/core/tools';
import { MemoryService } from '../../memory/memory.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QdrantService } from '../../files/qdrant.service';
import { searchWebTool } from './search-web.tool';
import { browseUrlTool } from './browse-url.tool';
import { searchUserFilesTool } from './search-user-files.tool';
import { memoryTools } from './memory.tool';
import { executeCodeTool } from './execute-code.tool';
import { getCurrentTimeTool } from './get-current-time.tool';

export function buildTools(
  userId: string,
  sessionId: string,
  httpService: HttpService,
  config: ConfigService,
  memoryService: MemoryService,
  prisma: PrismaService,
  qdrant: QdrantService,
): StructuredTool[] {
  return [
    searchUserFilesTool(userId, sessionId, qdrant, prisma),
    searchWebTool(httpService, config),
    browseUrlTool(httpService),
    executeCodeTool(httpService, config),
    getCurrentTimeTool(),
    ...memoryTools(userId, memoryService),
  ];
}

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { StructuredTool } from '@langchain/core/tools';
import { searchWebTool } from './search-web.tool';
import { browseUrlTool } from './browse-url.tool';
import { searchUserFilesTool } from './search-user-files.tool';

export function buildTools(
  userId: string,
  httpService: HttpService,
  config: ConfigService,
): StructuredTool[] {
  return [
    searchUserFilesTool(userId, config, httpService),
    searchWebTool(httpService, config),
    browseUrlTool(httpService),
  ];
}

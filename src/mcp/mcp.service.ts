import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface McpTool {
  name: string;
  description: string;
  invoke: (args: Record<string, unknown>) => Promise<string>;
}

@Injectable()
export class McpService {
  private connections = new Map<string, McpTool[]>();

  constructor(private readonly prisma: PrismaService) {}

  async getToolsForUser(userId: string): Promise<McpTool[]> {
    if (this.connections.has(userId)) {
      return this.connections.get(userId)!;
    }

    const servers = await this.prisma.mcpServer.findMany({ where: { userId } });
    const tools: McpTool[] = [];

    for (const server of servers) {
      const serverTools = await this.connectServer(server.url);
      tools.push(...serverTools);
    }

    this.connections.set(userId, tools);
    return tools;
  }

  async addServer(userId: string, name: string, url: string) {
    const record = await this.prisma.mcpServer.create({
      data: { userId, name, url },
    });
    this.connections.delete(userId);
    return record;
  }

  async removeServer(userId: string, serverId: string) {
    await this.prisma.mcpServer.delete({ where: { id: serverId, userId } });
    this.connections.delete(userId);
  }

  private async connectServer(url: string): Promise<McpTool[]> {
    // TODO: implement MCP protocol client (SSE or HTTP transport)
    // https://spec.modelcontextprotocol.io
    return [];
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MemoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async set(userId: string, key: string, value: string) {
    return this.prisma.memory.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value },
      update: { value },
    });
  }

  async get(userId: string, key: string) {
    return this.prisma.memory.findUnique({
      where: { userId_key: { userId, key } },
    });
  }

  async search(userId: string, query: string) {
    return this.prisma.memory.findMany({
      where: {
        userId,
        OR: [
          { key: { contains: query, mode: 'insensitive' } },
          { value: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
    });
  }

  async list(userId: string) {
    return this.prisma.memory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(userId: string, key: string) {
    return this.prisma.memory.delete({
      where: { userId_key: { userId, key } },
    });
  }
}

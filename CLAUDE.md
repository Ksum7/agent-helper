# Personal AI Assistant

Backend: NestJS + LangChain. Frontend по контексту (в планах).

## Стек

- **Backend:** NestJS (TypeScript)
- **LLM:** OpenAI-compatible (vLLM/Ollama)
- **Agent:** LangChain v1.3.3 + LangGraph v1.2.9
- **Embeddings:** Ollama + nomic-embed-text
- **Vector DB:** Qdrant
- **DB:** PostgreSQL (Prisma 6)
- **Cache:** Redis
- **Files:** MinIO
- **Infrastructure:** Docker Compose (dev)

## Модули

- `auth` — JWT (cookie), email
- `chat` — WebSocket + async streaming
- `agent` — LangChain `createChatAgent` с инструментами
- `files` — MinIO + Qdrant (embeddings)
- `memory` — PostgreSQL (upsert/search)
- `mcp` — стаб для MCP серверов

## Агент (src/agent/)

**Структура:**
- `agent-factory.ts` — `createChatAgent(llmUrl, llmModel, tools, systemPrompt)`
- `agent.service.ts` — AgentService.stream(userId, history, input)
- `tools/` — searchWeb, browseUrl (остальные TODO)

**API:** новый LangChain v1 — агент.stream({messages}, {streamMode: 'values'})

## Версии (актуально 2026-04-22)

```json
{
  "@langchain/core": "^1.1.40",
  "@langchain/langgraph": "^1.2.9",
  "@langchain/openai": "^1.4.4",
  "langchain": "^1.3.3",
  "@nestjs/*": "^11.1.19",
  "prisma": "^7.8.0"
}
```

## Context7 MCP

Всегда сначала используй Context7 для свежей документации по библиотекам (LangChain, NestJS, Prisma и др.).

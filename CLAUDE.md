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
- `files` — Управление файлами: MinIO (хранилище) + PostgreSQL (метаданные) + Qdrant (embeddings для searchable типов)
- `memory` — PostgreSQL (upsert/search)
- `mcp` — стаб для MCP серверов

## Агент (src/agent/)

**Структура:**
- `agent-factory.ts` — `createChatAgent(llmUrl, llmModel, tools, systemPrompt)`
- `agent.service.ts` — AgentService.stream(userId, history, input)
- `tools/` — searchUserFiles (RAG по документам), searchWeb, browseUrl

**Инструменты:**
- `search_user_files` — Поиск в embeddings загруженных файлов (PDF, DOCX, XLSX, TXT, MD → Qdrant)
- `search_web` — Поиск в интернете
- `browse_url` — Скачивание и парсинг URL

**API:** новый LangChain v1 — агент.stream({messages}, {streamMode: 'values'})

## Версии (актуально 2026-04-23)

```json
{
  "@langchain/core": "^1.1.40",
  "@langchain/langgraph": "^1.2.9",
  "@langchain/openai": "^1.4.4",
  "langchain": "^1.3.3",
  "@nestjs/*": "^11.1.19",
  "prisma": "^7.8.0",
  "pdf-parse": "^2.4.5",
  "mammoth": "^1.12.0",
  "exceljs": "^4.4.0"
}
```

## Files API (src/files/)

**Endpoints:**
- `POST /files` — загрузить файл (поддерживаемые типы: PDF, DOCX, XLSX, TXT, MD)
  - Автоматически создаёт embeddings в Qdrant для поиска
- `GET /files` — список файлов пользователя
- `GET /files/:id` — скачать оригинальный файл
- `DELETE /files/:id` — удалить файл

**Поддерживаемые форматы:**
- `text/plain` — обычный текст
- `text/markdown` — markdown файлы
- `application/pdf` — PDF (via pdf-parse v2.4.5)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` — DOCX (via mammoth v1.12.0)
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` — XLSX (via exceljs v4.4.0)
- `application/vnd.ms-excel` — XLS (via exceljs v4.4.0)

**Агент может:**
- Искать в embeddings через инструмент `search_user_files`
- Возвращать файлы по запросу пользователя (через API)
- Рассказывать какие файлы доступны (из списка)
- Удалять файлы (если явно запросил пользователь)

## Разработка и актуальность

**Context7 MCP** — используй для:
- 📚 Документации по библиотекам (LangChain, NestJS, Prisma и др.)
- 📦 Актуальности версий пакетов (ищи latest версии перед добавлением)
- 🔍 API синтаксиса и примеров кода
- ⚠️ Breaking changes между версиями

**Правило:** Перед добавлением нового пакета или изменением версии — **всегда проверь Context7 на актуальность** (не полагайся на знания от февраля 2025).

**WebSearch MCP** — если Context7 нет нужного результата:
- Проверка версий на npm.js (для пакетов)
- Статус поддержки проектов (dead/active)

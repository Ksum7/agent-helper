# Personal AI Assistant

Backend: NestJS + LangChain. Frontend по контексту (в планах).

## Стек

- **Backend:** NestJS (TypeScript)
- **LLM:** vLLM — модель `Qwen/Qwen3-14B` (AWQ, max-model-len 4096)
- **Agent:** LangChain v1.3.3 + LangGraph v1.2.9
- **Embeddings:** vLLM — модель `intfloat/e5-small-v2`
- **Reranker:** vLLM — модель `BAAI/bge-reranker-v2-m3`
- **Vector DB:** Qdrant
- **DB:** PostgreSQL (Prisma 7)
- **Cache:** Redis
- **Files:** MinIO
- **Infrastructure:** Docker Compose (dev) — 3 vLLM-сервиса (llm, embed, rerank) + postgres + redis + qdrant + minio

## Модули

- `auth` — JWT (cookie), email
- `chat` — WebSocket + async streaming
- `agent` — LangChain `createChatAgent` с встроенными инструментами
- `files` — Управление файлами: MinIO (хранилище) + PostgreSQL (метаданные) + Qdrant (embeddings); `TextExtractorService` для извлечения текста из файлов
- `memory` — PostgreSQL (upsert/search)

## Агент (src/agent/)

**Структура:**
- `agent-factory.ts` — `createChatAgent({ llmUrl, llmModel, tools })`
- `agent.service.ts` — AgentService.stream(userId, history, input)
- `tools/` — встроенные инструменты: searchUserFiles, searchWeb, browseUrl

**Встроенные инструменты (только предустановленные):**
- `search_user_files` — Поиск в embeddings файлов текущей чат-сессии (PDF, DOCX, XLSX, TXT, MD → Qdrant). Бот видит только файлы, загруженные в этой сессии.
- `search_web` — Поиск в интернете
- `browse_url` — Скачивание и парсинг URL

**Безопасность:**
- Кастомные MCP серверы отключены — поддерживаются только предустановленные инструменты
- Бот изолирован по сессиям — файлы видны только в контексте той сессии, где они загружены

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
  "@prisma/client": "^7.8.0",
  "@qdrant/js-client-rest": "^1.12.0",
  "pdf-parse": "^2.4.5",
  "mammoth": "^1.12.0",
  "exceljs": "^4.4.0",
  "nestjs-zod": "^5.0.1",
  "zod": "^4.1.12"
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

## Testing

**Тесты:** 63 unit тестов (все ✅ passing)
- `npm test` — запустить все тесты
- `npm test -- --watch` — watch mode
- `npm run test:cov` — coverage report

**Покрытие:**
- `auth`: service (register/login/me), guard (JWT validation, cookie extraction)
- `chat`: controller (session CRUD, SSE), service (async streaming), gateway (WebSocket)
- `files`: service (upload/list/delete with Qdrant), controller (sessionId), text-extractor (MIME validation)
- `memory`: service (delegation), repository (Prisma CRUD)

**Test patterns:**
- `Test.createTestingModule` + `useValue` mocks
- `jest.fn()` with `.mockImplementation()` for Prisma (避免 type issues)
- Async generator testing for streaming APIs
- Socket.io stub for WebSocket tests

## Кластеризация (PM2 + Redis)

**Включено с апреля 2026:** Redis адаптер для Socket.io синхронизирует WebSocket сессии между инстансами.

**Запуск кластера:**
```bash
npm run build
npm run cluster:start        # Запустить по количеству ядер CPU
pm2 status                   # Проверить статус
npm run cluster:logs         # Смотреть логи
```

**Требования:**
- Redis на localhost:6379 (переменная `REDIS_HOST`, `REDIS_PORT` в `.env`)
- PM2 установлен (`npm install pm2` уже в devDependencies)

**Структура:**
- `ecosystem.config.js` — конфиг PM2 (cluster mode, graceful reload, etc.)
- `nginx.conf` — load balancer для балансировки трафика между инстансами
- `chat.gateway.ts::afterInit()` — инициализация Redis адаптера для Socket.io
- `CLUSTER.md` — полная документация

**Команды:**
| Command | Effect |
|---------|--------|
| `npm run cluster:start` | Запустить кластер |
| `npm run cluster:reload` | Graceful reload (без downtime) |
| `npm run cluster:stop` | Остановить |
| `npm run cluster:monit` | Live мониторинг |

**Чего это дает:**
- ✅ Используются все ядра CPU
- ✅ Отказоустойчивость (если один инстанс упадет)
- ✅ Zero-downtime deployments
- ✅ WebSocket сессии синхронизируются через Redis

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

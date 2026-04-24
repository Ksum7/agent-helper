# Быстрый старт кластеризации

## Что было реализовано

✅ **PM2 кластеризация** — управление несколькими инстансами Node.js  
✅ **Redis адаптер** для Socket.io — синхронизация WebSocket сессий между инстансами  
✅ **nginx Load Balancing** — распределение трафика между инстансами  
✅ **Graceful reload** — обновления без downtime  

## Файлы

| Файл | Назначение |
|------|-----------|
| `ecosystem.config.js` | Конфиг PM2 |
| `src/chat/chat.gateway.ts` | Redis адаптер для Socket.io (метод `afterInit`) |
| `nginx.conf` | Конфиг для load balancing |
| `package.json` | Скрипты `cluster:*` |
| `CLUSTER.md` | Полная документация |
| `scripts/` | Вспомогательные скрипты |

## Быстрый старт (без компиляции)

```bash
# 1. Убедитесь, что Redis запущен
redis-cli ping  # должно вернуть PONG

# 2. Установите PM2 глобально (если еще не установлен)
npm install -g pm2

# 3. Запустите кластер (используя уже скомпилированный код)
pm2 start ecosystem.config.js

# 4. Проверьте статус
pm2 status
pm2 logs
```

## После компиляции

```bash
# Если npm run build заработает:
npm run build
npm run cluster:start
```

## Проверка Redis

```bash
# Windows / WSL
redis-cli ping

# Или если Redis в Docker
docker exec <redis-container> redis-cli ping
```

## Основные команды

```bash
pm2 status              # Статус всех процессов
pm2 logs                # Логи в реал-тайм
pm2 logs --lines 100    # Последние 100 строк логов
pm2 monit               # Мониторинг (подобно top)
pm2 reload ecosystem.config.js  # Graceful reload
pm2 stop ecosystem.config.js    # Остановить
pm2 delete ecosystem.config.js  # Удалить из PM2
```

## Архитектура

```
Клиент → nginx:80 (Load Balancer)
           ├─ Node.js:3000 (инстанс 1)
           ├─ Node.js:3001 (инстанс 2)
           └─ Node.js:3002 (инстанс 3)
                 ↓
           Redis (синхронизация Socket.io)
```

## Проблемы

**Порты уже в использовании:**
```bash
pm2 delete ecosystem.config.js
pm2 start ecosystem.config.js
```

**Redis не подключается:**
```bash
# Проверить, что Redis запущен
redis-cli ping

# Обновить .env
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Node процесс падает:**
```bash
pm2 logs  # Смотрите логи
pm2 show agent-helper  # Информация о процессе
```

## Дальше

1. Прочитайте полную документацию: [CLUSTER.md](CLUSTER.md)
2. Настройте nginx на вашем сервере (see `nginx.conf`)
3. Для production используйте `pm2 startup` для автозапуска

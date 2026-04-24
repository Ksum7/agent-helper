# Кластеризация с PM2

Руководство по запуску Node.js приложения в режиме кластера с использованием PM2.

## Преимущества

✅ **Используются все ядра CPU** — каждое ядро = один процесс  
✅ **Отказоустойчивость** — если один инстанс упадет, остальные работают  
✅ **Graceful reload** — обновление без downtime  
✅ **Zero-downtime deployments** — обновлять по одному инстансу  
✅ **Load balancing** — nginx распределяет нагрузку  
✅ **Redis sync** — Socket.io сессии синхронизируются через Redis  

## Требования

- Redis запущен (localhost:6379)
- Node.js ≥ 18
- PM2 установлен (`npm install pm2`)

## Быстрый старт

### 1. Собрать проект
```bash
npm run build
```

### 2. Запустить кластер
```bash
# Запустить с автоматическим количеством инстансов (по ядрам CPU)
npm run cluster:start

# Или явно указать количество инстансов
pm2 start ecosystem.config.js -i 3
```

### 3. Проверить статус
```bash
npm run cluster:status
# Или
pm2 status
```

### 4. Смотреть логи
```bash
npm run cluster:logs
# Или
pm2 logs
```

## Команды PM2

| Команда | Описание |
|---------|---------|
| `npm run cluster:start` | Запустить кластер |
| `npm run cluster:restart` | Перезагрузить все инстансы (с downtime) |
| `npm run cluster:reload` | Graceful reload (без downtime) |
| `npm run cluster:stop` | Остановить кластер |
| `npm run cluster:delete` | Удалить кластер из PM2 |
| `npm run cluster:logs` | Смотреть логи всех инстансов |
| `npm run cluster:status` | Показать статус |
| `npm run cluster:monit` | Live мониторинг (подобно `top`) |

## Nginx Load Balancing

Если у тебя несколько инстансов на одной машине, используй nginx для балансировки нагрузки:

```bash
# Копировать конфиг nginx
cp nginx.conf /etc/nginx/sites-available/agent-helper

# Проверить конфиг
sudo nginx -t

# Перезагрузить nginx
sudo systemctl reload nginx
```

**nginx конфиг:**
- Слушает порт 80
- Балансирует трафик на localhost:3000, :3001, :3002 (по алгоритму `least_conn`)
- Поддерживает WebSocket для Socket.io

## Структура

```
nginx:80 (Load Balancer)
    ├── Node.js:3000 (Инстанс 1)
    ├── Node.js:3001 (Инстанс 2)
    └── Node.js:3002 (Инстанс 3)
         ↓
    Redis (синхронизация Socket.io сессий)
```

## Конфигурация (ecosystem.config.js)

```javascript
instances: 'max',        // Использовать все ядра CPU
exec_mode: 'cluster',    // Кластерный режим (важно!)
max_memory_restart: '500M',  // Перезагрузить при превышении памяти
kill_timeout: 5000,      // Время на graceful shutdown
```

## Мониторинг

```bash
# Live мониторинг
pm2 monit

# История перезагрузок
pm2 show agent-helper

# Посмотреть все запущенные инстансы
pm2 list

# Посмотреть дерево процессов
pm2 ps
```

## Проблемы

### Redis не подключается
```bash
# Проверить, что Redis запущен
redis-cli ping
# Должен вернуть: PONG
```

### Порты уже в использовании
```bash
# Удалить старый кластер
npm run cluster:delete

# Или явно указать порты
PORT=3100 pm2 start ecosystem.config.js -i 2
```

### Graceful reload зависает
```bash
# Принудительная остановка
pm2 kill
pm2 start ecosystem.config.js
```

## Production

```bash
# Сохранить список PM2 процессов
pm2 save

# Восстановить при перезагрузке сервера
pm2 startup
```

## Отладка

```bash
# Подробные логи
pm2 logs --lines 1000

# Логи только ошибок
pm2 logs --err

# Логи конкретного инстанса
pm2 logs agent-helper --lines 100

# Realtime логи
pm2 logs --raw
```

## Пример с 3 инстансами

```bash
# Запустить 3 инстанса явно
pm2 start ecosystem.config.js -i 3

# Проверить
pm2 status
# ┌─────────────────────────────────────────────────────────┐
# │ id  │ name           │ mode │ ↺ │ status │ ↻  │ uptime  │
# ├─────┼────────────────┼──────┼───┼────────┼────┼─────────┤
# │ 0   │ agent-helper   │ fork │ 0 │ online │ 10 │ 1m      │
# │ 1   │ agent-helper   │ fork │ 0 │ online │ 10 │ 1m      │
# │ 2   │ agent-helper   │ fork │ 0 │ online │ 10 │ 1m      │
# └─────────────────────────────────────────────────────────┘

# Обновить код без downtime
npm run build
npm run cluster:reload

# Проверить логи
pm2 logs
```

## Расширение

Для масштабирования на несколько серверов:

1. Запустить Redis на отдельном сервере
2. Обновить `REDIS_HOST` в `.env`
3. Запустить PM2 кластер на каждом сервере
4. Использовать nginx на отдельной машине для глобального load balancing

```
Клиенты
   ↓
nginx (глобальный LB)
   ├── Сервер 1: nginx + PM2 (3 инстанса)
   ├── Сервер 2: nginx + PM2 (3 инстанса)
   └── Сервер 3: nginx + PM2 (3 инстанса)
        ↓
   Redis (одна инстанция или кластер)
```

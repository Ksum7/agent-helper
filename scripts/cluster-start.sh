#!/bin/bash

# Скрипт для запуска кластера с PM2

set -e

echo "🔨 Сборка проекта..."
npm run build

echo "🚀 Запуск кластера с PM2..."
pm2 start ecosystem.config.js

echo ""
echo "✅ Кластер запущен!"
echo ""
echo "📊 Статус инстансов:"
pm2 status

echo ""
echo "📝 Логи можно смотреть:"
echo "  pm2 logs"
echo "  pm2 logs --lines 100"
echo ""
echo "🔄 Перезагрузить кластер:"
echo "  pm2 reload ecosystem.config.js"
echo ""
echo "❌ Остановить кластер:"
echo "  pm2 stop ecosystem.config.js"
echo ""
echo "🗑️  Удалить кластер:"
echo "  pm2 delete ecosystem.config.js"

module.exports = {
  apps: [
    {
      name: 'agent-helper',
      script: './dist/main.js',
      instances: 'max', // Количество ядер CPU
      // instances: 3, // Или указать конкретное число
      exec_mode: 'cluster', // ◄─ Кластерный режим (важно!)
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Максимум памяти на инстанс
      max_memory_restart: '500M',
      // Автоматический перезапуск при краше
      autorestart: true,
      // Кол-во перезапусков перед выходом
      max_restarts: 10,
      // Время между перезапусками (мс)
      min_uptime: '10s',
      // Graceful shutdown (дать время на завершение соединений)
      kill_timeout: 5000,
      // Логи
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Watch режим (перезагрузка при изменении файлов)
      watch: false, // true только для разработки
      ignore_watch: ['node_modules', 'logs', 'dist'],
    },
  ],

  // Deploy конфигурация (опционально)
  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/agent-helper.git',
      path: '/var/www/agent-helper',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    },
  },
};

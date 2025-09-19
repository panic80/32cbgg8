module.exports = {
  apps: [{
    name: 'cf-travel-bot',
    script: './server/main.js',
    cwd: '/var/www/cbthis',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      RAG_SERVICE_URL: 'http://127.0.0.1:8000',
      ENABLE_LOGGING: 'true',
      CONFIG_PANEL_USER: process.env.CONFIG_PANEL_USER || 'admin',
      CONFIG_PANEL_PASSWORD: process.env.CONFIG_PANEL_PASSWORD || ''
    },
    max_memory_restart: '2G',
    error_file: '/var/log/cbthis/pm2-error.log',
    out_file: '/var/log/cbthis/pm2-out.log',
    merge_logs: true,
    autorestart: true,
    watch: false,
    restart_delay: 4000,
    listen_timeout: 10000,
    kill_timeout: 5000
  }]
};

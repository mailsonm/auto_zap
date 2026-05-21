module.exports = {
  apps: [
    {
      name: 'aria-bot',
      script: 'src/index.js',
      interpreter: 'node',
      interpreter_args: '--experimental-vm-modules',
      env: {
        NODE_ENV: 'production'
      },
      // Reiniciar automaticamente se o processo usar mais de 500MB de RAM
      max_memory_restart: '500M',
      // Aguardar 5 segundos antes de reiniciar após crash
      restart_delay: 5000,
      // Máximo de 10 restartes por minuto antes de parar
      max_restarts: 10,
      min_uptime: '10s',
      // Logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 30000
    }
  ]
};

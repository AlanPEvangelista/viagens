module.exports = {
  apps: [{
    name: 'controle-viagens',
    script: 'server.js',
    cwd: '/home/alan/controle-viagens',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8282,
      JWT_SECRET: 'travel_secret_key_2024_production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
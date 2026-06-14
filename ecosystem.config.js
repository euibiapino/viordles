module.exports = {
  apps: [
    {
      name: 'viordles',
      script: 'src/index.js',
      cwd: '/home/ubuntu/viordles',
      max_memory_restart: '300M',
      kill_timeout: 5000,
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 10,
      min_uptime: '30s',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'lavalink',
      script: 'java',
      args: '-DsocksProxyHost=localhost -DsocksProxyPort=40000 -jar Lavalink.jar',
      cwd: '/home/ubuntu/viordles/lavalink',
      interpreter: 'none',
      max_memory_restart: '800M',
      kill_timeout: 10000,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: '60s',
    },
  ],
};

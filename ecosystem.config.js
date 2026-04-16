module.exports = {
  apps: [
    // ── Next.js 프론트엔드 (포트 3000) ──────────────────────────────────
    {
      name: 'bitdot-frontend',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── Express API 서버 (포트 8000, Cloudflare Tunnel 설정과 일치) ────────
    {
      name: 'bitdot-api',
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

  ],
};

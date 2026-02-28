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

    // ── Express API 서버 (포트 3001) ─────────────────────────────────────
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
        PORT: 3001,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── Cloudflare Tunnel (api.maketruthy.com → localhost:3001) ──────────
    {
      name: 'bitdot-tunnel',
      script: 'cloudflared',
      args: 'tunnel --no-autoupdate run --token ' + (process.env.CLOUDFLARE_TUNNEL_TOKEN || ''),
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      interpreter: 'none',  // 직접 실행 (node interpreter 아님)
      env: {
        CLOUDFLARE_TUNNEL_TOKEN: process.env.CLOUDFLARE_TUNNEL_TOKEN || '',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};

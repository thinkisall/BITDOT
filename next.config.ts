import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // afterFiles: Next.js API route가 먼저 매칭되고, 없는 경로만 Cloudflare Tunnel로 프록시
      afterFiles: [
        {
          source: "/api/:path*",
          destination:
            "https://api.maketruthy.com/api/:path*",
        },
      ],
      // beforeFiles: 프로덕션에서만 multi-timeframe을 터널로 프록시
      beforeFiles: isProd
        ? [
            {
              source: "/api/multi-timeframe",
              destination: "https://api.maketruthy.com/api/multi-timeframe",
            },
          ]
        : [],
      fallback: [],
    };
  },
};

export default nextConfig;

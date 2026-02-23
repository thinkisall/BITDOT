import type { NextConfig } from "next";

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
      // beforeFiles: multi-timeframe은 Next.js API 라우트를 직접 사용하므로 프록시하지 않음
      beforeFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;

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
      // beforeFiles: /api/funding 은 route.ts → localhost:8000 직접 프록시로 처리
      // (Cloudflare 터널 경유 시 외부 API 응답 지연으로 530 발생)
      beforeFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;

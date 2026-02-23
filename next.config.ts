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
      // beforeFiles: funding, multi-timeframe은 외부 서버로 프록시
      //   - funding: 지역 제한 우회
      //   - multi-timeframe: Vercel Serverless에서 백그라운드 작업 불가 → Express 서버에서 처리
      beforeFiles: [
        {
          source: "/api/funding",
          destination: "https://api.maketruthy.com/api/funding",
        },
        {
          source: "/api/multi-timeframe",
          destination: "https://api.maketruthy.com/api/multi-timeframe",
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;

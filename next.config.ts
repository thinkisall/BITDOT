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
      // beforeFiles: funding API는 지역 제한 우회를 위해 외부 서버로 프록시
      beforeFiles: [
        {
          source: "/api/funding",
          destination: "https://api.maketruthy.com/api/funding",
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;

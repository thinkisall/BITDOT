import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // afterFiles: Next.js API route가 먼저 매칭되고, 없는 경로만 ngrok으로 프록시
      afterFiles: [
        {
          source: "/api/:path*",
          destination:
            "https://anopisthographically-ungambling-lashanda.ngrok-free.dev/api/:path*",
        },
      ],
      beforeFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;

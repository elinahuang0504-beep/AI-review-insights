import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 增大 API 请求体限制（大图片 base64 可能超过 1MB）
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // API routes 配置
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
        ],
      },
    ];
  },
};

export default nextConfig;

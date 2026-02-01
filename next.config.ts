import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // パフォーマンス最適化
  reactStrictMode: true,
  poweredByHeader: false,

  // 画像最適化
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "trello-members.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "trello-avatars.s3.amazonaws.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },

  // 実験的機能
  experimental: {
    optimizePackageImports: ["@/components", "@/stores"],
  },

  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;


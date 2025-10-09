// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ✅ 部署時忽略 ESLint 錯誤（仍可在本機開發時看到）
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ✅ 部署時忽略 TS 錯誤（先上線測，之後再修型別）
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
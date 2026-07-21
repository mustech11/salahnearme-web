import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Increase the maximum time allowed for static page generation.
   *
   * SalahNearMe generates thousands of static pages (cities, mosques,
   * businesses, prayer times, etc.). Some pages occasionally exceed
   * the default 60-second generation timeout on Vercel during production
   * builds, even though they complete successfully locally.
   *
   * This provides additional headroom while we continue optimising
   * Supabase queries and static generation performance.
   */
  staticPageGenerationTimeout: 180,

  reactStrictMode: true,

  poweredByHeader: false,

  compress: true,
};

export default nextConfig;
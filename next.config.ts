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

  /**
   * Next.js Image configuration
   *
   * Whitelist all image quality values used across SalahNearMe.
   * This permanently removes:
   *
   * Image with src "..." is using quality "78"
   * which is not configured in images.qualities
   */
  images: {
    qualities: [60, 65, 70, 75, 78, 80, 85, 90, 95, 100],

    formats: [
      "image/avif",
      "image/webp",
    ],

    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://www.salahnearme.com";

const baseUrl = SITE_URL.replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/businesses",
          "/businesses/",
          "/mosque/",
          "/near-me/pray",
          "/travel",
          "/travel/",
          "/hajj",
          "/hajj/",
          "/umrah",
          "/how-it-works",
          "/privacy",
          "/terms",
          "/disclaimer",
          "/sitemap.xml",
          "/robots.txt",
          "/manifest.json",
          "/icon-192.png",
          "/icon-512.png",
          "/social-icon.png",
          "/logo-horizontal.png",
        ],
        disallow: [
          "/admin",
          "/admin/",
          "/dashboard",
          "/dashboard/",
          "/business-dashboard",
          "/business-dashboard/",
          "/api",
          "/api/",
          "/claim",
          "/claim/",
          "/login",
          "/signup",
          "/payment/success",
          "/payment/cancel",
          "/advertise/confirm",
          "/advertise/setup",
        ],
      },
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/dashboard",
          "/dashboard/",
          "/business-dashboard",
          "/business-dashboard/",
          "/api",
          "/api/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
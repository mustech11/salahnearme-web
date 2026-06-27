import type { MetadataRoute } from "next";

const baseUrl = "https://www.salahnearme.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",

        allow: [
          "/",
          "/hajj",
          "/umrah",
          "/travel",
          "/mosque/",
          "/business/",
        ],

        disallow: [
          "/admin/",
          "/dashboard/",
          "/api/",
          "/claim/",
          "/auth/",
        ],
      },

      {
        userAgent: "GPTBot",
        allow: "/",
      },
    ],

    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}


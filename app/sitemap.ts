import type { MetadataRoute } from "next";

import { supabasePublic } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

type SitemapRow = {
  slug: string | null;
  updated_at?: string | null;
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://www.salahnearme.com";

const baseUrl = SITE_URL.replace(/\/+$/, "");

function toLastModified(value: string | null | undefined) {
  if (!value) {
    return new Date();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

function cleanSlug(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.trim().replace(/^\/+|\/+$/g, "");
}

function uniqueUrls(items: MetadataRoute.Sitemap) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.url)) {
      return false;
    }

    seen.add(item.url);
    return true;
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = supabasePublic();
  const now = new Date();

  const [citiesResult, mosquesResult, businessesResult] = await Promise.all([
    supabase
      .from("cities")
      .select("slug,updated_at")
      .eq("is_active", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(5000),

    supabase
      .from("mosques")
      .select("slug,updated_at")
      .eq("is_active", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(10000),

    supabase
      .from("businesses")
      .select("slug,updated_at")
      .eq("is_active", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(10000),
  ]);

  if (citiesResult.error) {
    console.error("sitemap cities error:", citiesResult.error.message);
  }

  if (mosquesResult.error) {
    console.error("sitemap mosques error:", mosquesResult.error.message);
  }

  if (businessesResult.error) {
    console.error("sitemap businesses error:", businessesResult.error.message);
  }

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/near-me/pray`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/businesses`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/travel`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/travel/near-me`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/hajj`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/hajj/guide`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/umrah`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/advertise`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: `${baseUrl}/how-it-works`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.65,
    },
  ];

  const cityPages: MetadataRoute.Sitemap =
    ((citiesResult.data ?? []) as SitemapRow[])
      .map((city) => {
        const slug = cleanSlug(city.slug);

        if (!slug) {
          return null;
        }

        return {
          url: `${baseUrl}/${slug}`,
          lastModified: toLastModified(city.updated_at),
          changeFrequency: "daily" as const,
          priority: 0.9,
        };
      })
      .filter((item): item is MetadataRoute.Sitemap[number] => Boolean(item));

  const cityBusinessPages: MetadataRoute.Sitemap =
    ((citiesResult.data ?? []) as SitemapRow[])
      .map((city) => {
        const slug = cleanSlug(city.slug);

        if (!slug) {
          return null;
        }

        return {
          url: `${baseUrl}/${slug}/businesses`,
          lastModified: toLastModified(city.updated_at),
          changeFrequency: "daily" as const,
          priority: 0.82,
        };
      })
      .filter((item): item is MetadataRoute.Sitemap[number] => Boolean(item));

  const cityMosquePages: MetadataRoute.Sitemap =
    ((citiesResult.data ?? []) as SitemapRow[])
      .map((city) => {
        const slug = cleanSlug(city.slug);

        if (!slug) {
          return null;
        }

        return {
          url: `${baseUrl}/${slug}/mosques`,
          lastModified: toLastModified(city.updated_at),
          changeFrequency: "daily" as const,
          priority: 0.84,
        };
      })
      .filter((item): item is MetadataRoute.Sitemap[number] => Boolean(item));

  const mosquePages: MetadataRoute.Sitemap =
    ((mosquesResult.data ?? []) as SitemapRow[])
      .map((mosque) => {
        const slug = cleanSlug(mosque.slug);

        if (!slug) {
          return null;
        }

        return {
          url: `${baseUrl}/mosque/${slug}`,
          lastModified: toLastModified(mosque.updated_at),
          changeFrequency: "daily" as const,
          priority: 0.78,
        };
      })
      .filter((item): item is MetadataRoute.Sitemap[number] => Boolean(item));

  const businessPages: MetadataRoute.Sitemap =
    ((businessesResult.data ?? []) as SitemapRow[])
      .map((business) => {
        const slug = cleanSlug(business.slug);

        if (!slug) {
          return null;
        }

        return {
          url: `${baseUrl}/businesses/${slug}`,
          lastModified: toLastModified(business.updated_at),
          changeFrequency: "weekly" as const,
          priority: 0.72,
        };
      })
      .filter((item): item is MetadataRoute.Sitemap[number] => Boolean(item));

  return uniqueUrls([
    ...staticPages,
    ...cityPages,
    ...cityBusinessPages,
    ...cityMosquePages,
    ...mosquePages,
    ...businessPages,
  ]);
}
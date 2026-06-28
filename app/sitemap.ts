import type { MetadataRoute } from "next";

import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type SitemapRow = {
  slug: string | null;
  updated_at: string | null;
};

type SitemapEntry = MetadataRoute.Sitemap[number];

const DEFAULT_BASE_URL = "https://www.salahnearme.com";

function getBaseUrl() {
  const value =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    DEFAULT_BASE_URL;

  return value.replace(/\/+$/, "");
}

function cleanSlug(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.trim().replace(/^\/+|\/+$/g, "");
}

function safeDate(value: string | null | undefined, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date;
}

function createEntry({
  url,
  lastModified,
  changeFrequency,
  priority,
}: {
  url: string;
  lastModified: Date;
  changeFrequency: SitemapEntry["changeFrequency"];
  priority: number;
}): SitemapEntry {
  return {
    url,
    lastModified,
    changeFrequency,
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await supabaseServer();
  const baseUrl = getBaseUrl();
  const now = new Date();

  const [citiesResult, mosquesResult, businessesResult] = await Promise.all([
    supabase
      .from("cities")
      .select("slug,updated_at")
      .eq("is_active", true),

    supabase
      .from("mosques")
      .select("slug,updated_at")
      .eq("is_active", true),

    supabase
      .from("businesses")
      .select("slug,updated_at")
      .eq("is_active", true),
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
    createEntry({
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    }),
    createEntry({
      url: `${baseUrl}/near-me/pray`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.98,
    }),
    createEntry({
      url: `${baseUrl}/businesses`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    }),
    createEntry({
      url: `${baseUrl}/travel`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.92,
    }),
    createEntry({
      url: `${baseUrl}/travel/near-me`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    }),
    createEntry({
      url: `${baseUrl}/travel/map`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    }),
    createEntry({
      url: `${baseUrl}/hajj`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    }),
    createEntry({
      url: `${baseUrl}/hajj/guide`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.86,
    }),
    createEntry({
      url: `${baseUrl}/umrah`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.88,
    }),
    createEntry({
      url: `${baseUrl}/advertise`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.75,
    }),
    createEntry({
      url: `${baseUrl}/add-business`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.72,
    }),
    createEntry({
      url: `${baseUrl}/how-it-works`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    }),
    createEntry({
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    }),
    createEntry({
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    }),
    createEntry({
      url: `${baseUrl}/disclaimer`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    }),
  ];

  const cityPages: MetadataRoute.Sitemap = (
    (citiesResult.data ?? []) as SitemapRow[]
  )
    .map((city) => {
      const slug = cleanSlug(city.slug);

      if (!slug) {
        return null;
      }

      return createEntry({
        url: `${baseUrl}/${slug}`,
        lastModified: safeDate(city.updated_at, now),
        changeFrequency: "daily",
        priority: 0.9,
      });
    })
    .filter((entry): entry is SitemapEntry => entry !== null);

  const cityBusinessPages: MetadataRoute.Sitemap = (
    (citiesResult.data ?? []) as SitemapRow[]
  )
    .map((city) => {
      const slug = cleanSlug(city.slug);

      if (!slug) {
        return null;
      }

      return createEntry({
        url: `${baseUrl}/${slug}/businesses`,
        lastModified: safeDate(city.updated_at, now),
        changeFrequency: "daily",
        priority: 0.86,
      });
    })
    .filter((entry): entry is SitemapEntry => entry !== null);

  const cityMosquePages: MetadataRoute.Sitemap = (
    (citiesResult.data ?? []) as SitemapRow[]
  )
    .map((city) => {
      const slug = cleanSlug(city.slug);

      if (!slug) {
        return null;
      }

      return createEntry({
        url: `${baseUrl}/${slug}/mosques`,
        lastModified: safeDate(city.updated_at, now),
        changeFrequency: "daily",
        priority: 0.86,
      });
    })
    .filter((entry): entry is SitemapEntry => entry !== null);

  const cityPrayerTimePages: MetadataRoute.Sitemap = (
    (citiesResult.data ?? []) as SitemapRow[]
  )
    .map((city) => {
      const slug = cleanSlug(city.slug);

      if (!slug) {
        return null;
      }

      return createEntry({
        url: `${baseUrl}/${slug}/prayer-times`,
        lastModified: safeDate(city.updated_at, now),
        changeFrequency: "daily",
        priority: 0.82,
      });
    })
    .filter((entry): entry is SitemapEntry => entry !== null);

  const mosquePages: MetadataRoute.Sitemap = (
    (mosquesResult.data ?? []) as SitemapRow[]
  )
    .map((mosque) => {
      const slug = cleanSlug(mosque.slug);

      if (!slug) {
        return null;
      }

      return createEntry({
        url: `${baseUrl}/mosque/${slug}`,
        lastModified: safeDate(mosque.updated_at, now),
        changeFrequency: "daily",
        priority: 0.8,
      });
    })
    .filter((entry): entry is SitemapEntry => entry !== null);

  const mosqueTimetablePages: MetadataRoute.Sitemap = (
    (mosquesResult.data ?? []) as SitemapRow[]
  )
    .map((mosque) => {
      const slug = cleanSlug(mosque.slug);

      if (!slug) {
        return null;
      }

      return createEntry({
        url: `${baseUrl}/mosque/${slug}/timetable`,
        lastModified: safeDate(mosque.updated_at, now),
        changeFrequency: "daily",
        priority: 0.74,
      });
    })
    .filter((entry): entry is SitemapEntry => entry !== null);

  const mosqueSponsorPages: MetadataRoute.Sitemap = (
    (mosquesResult.data ?? []) as SitemapRow[]
  )
    .map((mosque) => {
      const slug = cleanSlug(mosque.slug);

      if (!slug) {
        return null;
      }

      return createEntry({
        url: `${baseUrl}/sponsor/mosque/${slug}`,
        lastModified: safeDate(mosque.updated_at, now),
        changeFrequency: "weekly",
        priority: 0.45,
      });
    })
    .filter((entry): entry is SitemapEntry => entry !== null);

  const businessPages: MetadataRoute.Sitemap = (
    (businessesResult.data ?? []) as SitemapRow[]
  )
    .map((business) => {
      const slug = cleanSlug(business.slug);

      if (!slug) {
        return null;
      }

      return createEntry({
        url: `${baseUrl}/businesses/${slug}`,
        lastModified: safeDate(business.updated_at, now),
        changeFrequency: "weekly",
        priority: 0.72,
      });
    })
    .filter((entry): entry is SitemapEntry => entry !== null);

  return [
    ...staticPages,
    ...cityPages,
    ...cityBusinessPages,
    ...cityMosquePages,
    ...cityPrayerTimePages,
    ...mosquePages,
    ...mosqueTimetablePages,
    ...mosqueSponsorPages,
    ...businessPages,
  ];
}
import type { MetadataRoute } from "next";
import { supabaseServer } from "@/lib/supabaseServer";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await supabaseServer();

  const baseUrl = "https://www.salahnearme.com";

  const [
    { data: cities },
    { data: mosques },
    { data: businesses },
  ] = await Promise.all([
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

  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },

    {
      url: `${baseUrl}/travel`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },

    {
      url: `${baseUrl}/hajj`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },

    {
      url: `${baseUrl}/umrah`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },

    {
      url: `${baseUrl}/businesses`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
  ];

  const cityPages =
    cities?.map((city) => ({
      url: `${baseUrl}/${city.slug}`,
      lastModified: city.updated_at
        ? new Date(city.updated_at)
        : now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })) ?? [];

  const mosquePages =
    mosques?.map((mosque) => ({
      url: `${baseUrl}/mosque/${mosque.slug}`,
      lastModified: mosque.updated_at
        ? new Date(mosque.updated_at)
        : now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })) ?? [];

  const businessPages =
    businesses?.map((business) => ({
      url: `${baseUrl}/business/${business.slug}`,
      lastModified: business.updated_at
        ? new Date(business.updated_at)
        : now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })) ?? [];

  return [
    ...staticPages,
    ...cityPages,
    ...mosquePages,
    ...businessPages,
  ];
}


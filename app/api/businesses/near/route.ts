import { NextRequest, NextResponse } from "next/server";

import { sortBusinessesByRank } from "@/lib/businessRanking";
import { supabasePublic } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NearbyBusinessRpcRow = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  postcode: string | null;
  website: string | null;
  phone: string | null;
  maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  featured: boolean | null;
  featured_rank: number | null;
  pricing_tier: string | null;
  subscription_type?: string | null;
  paid_until: string | null;
  is_verified: boolean | null;
  sponsorship_active?: boolean | null;
  city_sponsor?: boolean | null;
  mosque_sponsor?: boolean | null;
  sponsor_mosque_id?: string | null;
  sponsor_city_id?: number | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  gallery_urls?: string[] | null;
  halal_confidence?: string | null;
  halal_score?: number | null;
  distance_meters?: number | null;
};

type BusinessMediaRow = {
  id: string;
  logo_url: string | null;
  cover_image_url: string | null;
  gallery_urls: string[] | null;
};

function toNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isValidLatitude(value: number | null): value is number {
  return value !== null && value >= -90 && value <= 90;
}

function isValidLongitude(value: number | null): value is number {
  return value !== null && value >= -180 && value <= 180;
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusMeters = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
}

function normaliseGallery(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPaidActive(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time) && time > Date.now();
}

function getDistanceMeters(
  userLat: number,
  userLng: number,
  business: NearbyBusinessRpcRow
) {
  if (
    typeof business.distance_meters === "number" &&
    Number.isFinite(business.distance_meters)
  ) {
    return Math.round(business.distance_meters);
  }

  if (
    typeof business.latitude !== "number" ||
    typeof business.longitude !== "number"
  ) {
    return null;
  }

  return Math.round(
    haversineMeters(userLat, userLng, business.latitude, business.longitude)
  );
}

async function getBusinessMedia(
  businessIds: string[]
): Promise<Map<string, BusinessMediaRow>> {
  const media = new Map<string, BusinessMediaRow>();

  if (businessIds.length === 0) {
    return media;
  }

  const supabase = supabasePublic();

  const { data, error } = await supabase
    .from("businesses")
    .select("id, logo_url, cover_image_url, gallery_urls")
    .in("id", businessIds);

  if (error) {
    console.error("near businesses media lookup error:", error);
    return media;
  }

  for (const item of (data ?? []) as BusinessMediaRow[]) {
    media.set(item.id, {
      id: item.id,
      logo_url: item.logo_url ?? null,
      cover_image_url: item.cover_image_url ?? null,
      gallery_urls: normaliseGallery(item.gallery_urls),
    });
  }

  return media;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = toNumber(searchParams.get("lat"));
    const lng = toNumber(searchParams.get("lng"));

    const radius = clamp(
      toNumber(searchParams.get("radius")) ?? 5000,
      500,
      50000
    );

    const limit = clamp(toNumber(searchParams.get("limit")) ?? 50, 1, 100);

    if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing or invalid lat/lng query parameters. Latitude must be -90 to 90 and longitude must be -180 to 180.",
        },
        {
          status: 400,
        }
      );
    }

    const userLat = lat;
    const userLng = lng;

    const supabase = supabasePublic();

    const { data, error } = await supabase.rpc("nearby_halal_businesses", {
      user_lat: userLat,
      user_lng: userLng,
      radius_meters: radius,
      result_limit: limit,
    });

    if (error) {
      console.error("nearby_halal_businesses RPC error:", error);

      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    const rpcBusinesses = (data ?? []) as NearbyBusinessRpcRow[];

    const businessIds = rpcBusinesses
      .map((business) => business.id)
      .filter(Boolean);

    const mediaByBusinessId = await getBusinessMedia(businessIds);

    const businesses = rpcBusinesses
      .map((business) => {
        const media = mediaByBusinessId.get(business.id);
        const distanceMeters = getDistanceMeters(userLat, userLng, business);

        return {
          id: business.id,
          name: business.name,
          slug: business.slug,
          category: business.category,
          city: business.city,
          area: business.area,
          address: business.address,
          postcode: business.postcode,
          website: business.website,
          phone: business.phone,
          maps_url: business.maps_url,

          logo_url: business.logo_url ?? media?.logo_url ?? null,
          cover_image_url:
            business.cover_image_url ?? media?.cover_image_url ?? null,
          gallery_urls: normaliseGallery(
            business.gallery_urls ?? media?.gallery_urls ?? []
          ),

          latitude: business.latitude,
          longitude: business.longitude,

          featured: business.featured,
          featured_rank: business.featured_rank,
          pricing_tier: business.pricing_tier,
          subscription_type: business.subscription_type ?? null,
          paid_until: business.paid_until,
          is_verified: business.is_verified,
          sponsorship_active: business.sponsorship_active ?? null,
          city_sponsor: business.city_sponsor ?? null,
          mosque_sponsor: business.mosque_sponsor ?? null,
          sponsor_mosque_id: business.sponsor_mosque_id ?? null,
          sponsor_city_id: business.sponsor_city_id ?? null,

          halal_confidence: business.halal_confidence ?? null,
          halal_score: business.halal_score ?? null,

          distance_meters: distanceMeters,
          distance_km:
            typeof distanceMeters === "number"
              ? Number((distanceMeters / 1000).toFixed(2))
              : null,
          distance_miles:
            typeof distanceMeters === "number"
              ? Number((distanceMeters / 1609.344).toFixed(2))
              : null,
        };
      })
      .filter((business) => {
        if (typeof business.distance_meters !== "number") {
          return true;
        }

        return business.distance_meters <= radius;
      });

    const rankedByBusinessPriority = sortBusinessesByRank(businesses, {
      cityName: null,
      cityId: null,
      mosqueId: null,
    });

    const ranked = rankedByBusinessPriority
      .sort((a, b) => {
        const aSponsored =
          (a.city_sponsor || a.mosque_sponsor || a.sponsorship_active) &&
          isPaidActive(a.paid_until)
            ? 1
            : 0;

        const bSponsored =
          (b.city_sponsor || b.mosque_sponsor || b.sponsorship_active) &&
          isPaidActive(b.paid_until)
            ? 1
            : 0;

        if (aSponsored !== bSponsored) {
          return bSponsored - aSponsored;
        }

        const aFeatured = a.featured && isPaidActive(a.paid_until) ? 1 : 0;
        const bFeatured = b.featured && isPaidActive(b.paid_until) ? 1 : 0;

        if (aFeatured !== bFeatured) {
          return bFeatured - aFeatured;
        }

        const aDistance =
          typeof a.distance_meters === "number"
            ? a.distance_meters
            : Number.POSITIVE_INFINITY;

        const bDistance =
          typeof b.distance_meters === "number"
            ? b.distance_meters
            : Number.POSITIVE_INFINITY;

        return aDistance - bDistance;
      })
      .slice(0, limit);

    return NextResponse.json(
      {
        ok: true,
        count: ranked.length,
        radius_meters: radius,
        radius_km: Number((radius / 1000).toFixed(2)),
        radius_miles: Number((radius / 1609.344).toFixed(2)),
        businesses: ranked,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("nearby halal businesses route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load nearby halal businesses.",
      },
      {
        status: 500,
      }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  address: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  maps_url: string | null;
  is_verified: boolean | null;
  featured: boolean | null;
};

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    const radiusMiles = Number(searchParams.get("radius") ?? "10");
    const limit = Number(searchParams.get("limit") ?? "20");

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "Missing or invalid lat/lng" },
        { status: 400 }
      );
    }

    const latDelta = radiusMiles / 69;
    const lngDelta = radiusMiles / (Math.cos((lat * Math.PI) / 180) * 69 || 1);

    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;

    const { data: businessesRaw, error } = await supabaseAdmin
      .from("businesses")
      .select(
        `
        id,
        name,
        slug,
        category,
        city,
        address,
        postcode,
        latitude,
        longitude,
        website,
        maps_url,
        is_verified,
        featured
      `
      )
      .gte("latitude", minLat)
      .lte("latitude", maxLat)
      .gte("longitude", minLng)
      .lte("longitude", maxLng);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const businesses = ((businessesRaw ?? []) as BusinessRow[])
      .filter(
        (b) =>
          typeof b.latitude === "number" &&
          typeof b.longitude === "number"
      )
      .map((b) => ({
        ...b,
        distance_miles: haversineMiles(lat, lng, b.latitude!, b.longitude!),
      }))
      .filter((b) => b.distance_miles <= radiusMiles)
      .sort((a, b) => {
        if ((a.featured ?? false) !== (b.featured ?? false)) {
          return a.featured ? -1 : 1;
        }
        if ((a.is_verified ?? false) !== (b.is_verified ?? false)) {
          return a.is_verified ? -1 : 1;
        }
        return a.distance_miles - b.distance_miles;
      })
      .slice(0, limit);

    return NextResponse.json({
      ok: true,
      count: businesses.length,
      businesses,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected nearby businesses error",
      },
      { status: 500 }
    );
  }
}


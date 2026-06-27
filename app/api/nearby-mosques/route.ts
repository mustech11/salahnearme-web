import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  area: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  parking: boolean | null;
  womens_space: boolean | null;
  wheelchair_access: boolean | null;
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

    const { data: mosquesRaw, error } = await supabaseAdmin
      .from("mosques")
      .select(
        `
        id,
        name,
        slug,
        area,
        city,
        postcode,
        address,
        latitude,
        longitude,
        parking,
        womens_space,
        wheelchair_access
      `
      )
      .eq("is_active", true)
      .gte("latitude", minLat)
      .lte("latitude", maxLat)
      .gte("longitude", minLng)
      .lte("longitude", maxLng);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mosques = ((mosquesRaw ?? []) as MosqueRow[])
      .filter(
        (m) =>
          typeof m.latitude === "number" &&
          typeof m.longitude === "number"
      )
      .map((m) => ({
        ...m,
        distance_miles: haversineMiles(lat, lng, m.latitude!, m.longitude!),
      }))
      .filter((m) => m.distance_miles <= radiusMiles)
      .sort((a, b) => a.distance_miles - b.distance_miles)
      .slice(0, limit);

    return NextResponse.json({
      ok: true,
      count: mosques.length,
      mosques,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected nearby engine error",
      },
      { status: 500 }
    );
  }
}


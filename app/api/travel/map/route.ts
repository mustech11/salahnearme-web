import { NextRequest, NextResponse } from "next/server";
import { supabasePublic } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (n: number) => (n * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  const supabase = supabasePublic();
  const { searchParams } = new URL(req.url);

  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radius = Number(searchParams.get("radius") ?? "8000");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "Missing or invalid lat/lng" },
      { status: 400 }
    );
  }

  const { data: mosques, error: mosquesError } = await supabase
    .from("mosques")
    .select(
      "id,name,slug,city,area,address,postcode,latitude,longitude,verified_status,source"
    )
    .eq("is_active", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(2000);

  if (mosquesError) {
    return NextResponse.json({ error: mosquesError.message }, { status: 500 });
  }

  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select(
      "id,name,slug,category,city,area,address,postcode,latitude,longitude,is_verified,featured,halal_confidence,maps_url,website,phone"
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(2000);

  if (businessesError) {
    return NextResponse.json(
      { error: businessesError.message },
      { status: 500 }
    );
  }

  const mosqueResults = (mosques ?? [])
    .map((m) => ({
      type: "mosque" as const,
      ...m,
      distance_meters: distanceMeters(
        lat,
        lng,
        Number(m.latitude),
        Number(m.longitude)
      ),
    }))
    .filter((m) => m.distance_meters <= radius)
    .sort((a, b) => a.distance_meters - b.distance_meters)
    .slice(0, 80);

  const businessResults = (businesses ?? [])
    .map((b) => ({
      type: "business" as const,
      ...b,
      distance_meters: distanceMeters(
        lat,
        lng,
        Number(b.latitude),
        Number(b.longitude)
      ),
    }))
    .filter((b) => b.distance_meters <= radius)
    .sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      if (a.is_verified && !b.is_verified) return -1;
      if (!a.is_verified && b.is_verified) return 1;
      return a.distance_meters - b.distance_meters;
    })
    .slice(0, 80);

  return NextResponse.json({
    ok: true,
    center: { lat, lng },
    radius,
    mosques: mosqueResults,
    businesses: businessResults,
  });
}


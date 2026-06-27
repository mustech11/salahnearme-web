import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LaunchStatus = "ready" | "needs-data" | "do-not-launch";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function launchStatus(input: {
  hasCoordinates: boolean;
  hasPrayerTimes: boolean;
  mosqueCount: number;
  businessCount: number;
}): LaunchStatus {
  if (
    input.hasCoordinates &&
    input.hasPrayerTimes &&
    input.mosqueCount >= 3 &&
    input.businessCount >= 3
  ) {
    return "ready";
  }

  if (input.hasCoordinates && input.mosqueCount >= 1) {
    return "needs-data";
  }

  return "do-not-launch";
}

export async function GET() {
  try {
    const permission = await requireAdmin();

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error: permission.error,
        },
        permission.status
      );
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [citiesResult, prayerTimesResult, mosquesResult, businessesResult] =
      await Promise.all([
        supabaseAdmin
          .from("cities")
          .select("id,name,slug,country,timezone,latitude,longitude,is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),

        supabaseAdmin
          .from("city_prayer_times")
          .select("city_id,month,year")
          .eq("month", month)
          .eq("year", year),

        supabaseAdmin
          .from("mosques")
          .select("id,city_id,city,is_active")
          .eq("is_active", true),

        supabaseAdmin
          .from("businesses")
          .select("id,city,is_active,is_live")
          .eq("is_active", true),
      ]);

    for (const result of [
      citiesResult,
      prayerTimesResult,
      mosquesResult,
      businessesResult,
    ]) {
      if (result.error) {
        console.error("city-launch-readiness lookup error:", result.error);

        return jsonResponse(
          {
            ok: false,
            error: "Could not load city launch readiness data.",
          },
          500
        );
      }
    }

    const cities = citiesResult.data ?? [];
    const prayerTimes = prayerTimesResult.data ?? [];
    const mosques = mosquesResult.data ?? [];
    const businesses = businessesResult.data ?? [];

    const prayerCityIds = new Set(
      prayerTimes.map((row) => String(row.city_id))
    );

    const mosqueCountByCityId = new Map<string, number>();

    for (const mosque of mosques) {
      if (!mosque.city_id) {
        continue;
      }

      const cityId = String(mosque.city_id);

      mosqueCountByCityId.set(
        cityId,
        (mosqueCountByCityId.get(cityId) ?? 0) + 1
      );
    }

    const businessCountByCityName = new Map<string, number>();

    for (const business of businesses) {
      if (!business.city) {
        continue;
      }

      const cityName = String(business.city);

      businessCountByCityName.set(
        cityName,
        (businessCountByCityName.get(cityName) ?? 0) + 1
      );
    }

    const rows = cities.map((city) => {
      const cityId = String(city.id);
      const cityName = city.name ?? "";

      const hasCoordinates =
        typeof city.latitude === "number" &&
        Number.isFinite(city.latitude) &&
        typeof city.longitude === "number" &&
        Number.isFinite(city.longitude);

      const hasPrayerTimes = prayerCityIds.has(cityId);
      const mosqueCount = mosqueCountByCityId.get(cityId) ?? 0;
      const businessCount = businessCountByCityName.get(cityName) ?? 0;

      const status = launchStatus({
        hasCoordinates,
        hasPrayerTimes,
        mosqueCount,
        businessCount,
      });

      const missing = [
        !hasCoordinates ? "coordinates" : null,
        !hasPrayerTimes ? "current month prayer times" : null,
        mosqueCount < 3 ? "mosques" : null,
        businessCount < 3 ? "businesses" : null,
      ].filter((item): item is string => Boolean(item));

      return {
        id: city.id,
        name: city.name,
        slug: city.slug,
        country: city.country,
        timezone: city.timezone,
        hasCoordinates,
        hasPrayerTimes,
        mosqueCount,
        businessCount,
        status,
        missing,
      };
    });

    return jsonResponse({
      ok: true,
      month,
      year,
      totals: {
        cities: rows.length,
        ready: rows.filter((row) => row.status === "ready").length,
        needsData: rows.filter((row) => row.status === "needs-data").length,
        doNotLaunch: rows.filter((row) => row.status === "do-not-launch")
          .length,
      },
      cities: rows,
    });
  } catch (error) {
    console.error("city-launch-readiness route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not inspect city launch readiness.",
      },
      500
    );
  }
}


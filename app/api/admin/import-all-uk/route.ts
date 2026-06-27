import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CityRow = {
  slug: string;
  name: string;
  country: string | null;
  country_code: string | null;
};

type ImportResult = {
  city: string;
  found: number;
  inserted: number;
  merged: number;
  skipped: number;
  invalid: number;
  success: boolean;
  error?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanNumber(value: string | null, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export async function GET(req: Request) {
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

    const { searchParams, origin } = new URL(req.url);

    const radius = clamp(cleanNumber(searchParams.get("radius"), 5000), 1000, 30000);
    const delayMs = clamp(cleanNumber(searchParams.get("delayMs"), 1500), 500, 10000);
    const limit = clamp(cleanNumber(searchParams.get("limit"), 0), 0, 500);

    const { data: citiesRaw, error: citiesError } = await supabaseAdmin
      .from("cities")
      .select("slug,name,country,country_code")
      .eq("is_active", true)
      .in("country_code", ["GB", "UK"])
      .order("name", { ascending: true });

    if (citiesError) {
      console.error("import-all-uk cities lookup error:", citiesError);

      return jsonResponse(
        {
          ok: false,
          error: "Could not load UK cities.",
        },
        500
      );
    }

    let cities = (citiesRaw ?? []) as CityRow[];

    if (limit > 0) {
      cities = cities.slice(0, limit);
    }

    const results: ImportResult[] = [];

    const totals = {
      citiesProcessed: 0,
      found: 0,
      inserted: 0,
      merged: 0,
      skipped: 0,
      invalid: 0,
      failed: 0,
    };

    const cronSecret = process.env.CRON_SECRET;

    for (let index = 0; index < cities.length; index++) {
      const city = cities[index];

      try {
        const url = new URL("/api/import-mosques", origin);

        url.searchParams.set("city", city.slug);
        url.searchParams.set("radius", String(radius));

        const response = await fetch(url.toString(), {
          method: "GET",
          cache: "no-store",
          headers: cronSecret
            ? {
                "x-cron-secret": cronSecret,
              }
            : {},
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          results.push({
            city: city.slug,
            found: 0,
            inserted: 0,
            merged: 0,
            skipped: 0,
            invalid: 0,
            success: false,
            error:
              typeof data.error === "string"
                ? data.error
                : "Unknown import error.",
          });

          totals.citiesProcessed++;
          totals.failed++;
        } else {
          const found = Number(data.found ?? 0);
          const inserted = Number(data.inserted ?? 0);
          const merged = Number(data.merged ?? 0);
          const skipped = Number(data.skipped ?? 0);
          const invalid = Number(data.invalid ?? 0);

          results.push({
            city: city.slug,
            found,
            inserted,
            merged,
            skipped,
            invalid,
            success: true,
          });

          totals.citiesProcessed++;
          totals.found += found;
          totals.inserted += inserted;
          totals.merged += merged;
          totals.skipped += skipped;
          totals.invalid += invalid;
        }
      } catch (error) {
        results.push({
          city: city.slug,
          found: 0,
          inserted: 0,
          merged: 0,
          skipped: 0,
          invalid: 0,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unexpected bulk import error.",
        });

        totals.citiesProcessed++;
        totals.failed++;
      }

      if (index < cities.length - 1 && delayMs > 0) {
        await sleep(delayMs);
      }
    }

    return jsonResponse({
      ok: true,
      success: true,
      radius,
      delayMs,
      limit,
      totals,
      results,
    });
  } catch (error) {
    console.error("import-all-uk route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Unexpected bulk importer error.",
      },
      500
    );
  }
}


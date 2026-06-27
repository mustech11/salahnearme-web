import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  address: string | null;
  postcode: string | null;
  source: string | null;
  verified_status: string | null;
  normalized_name?: string | null;
  normalized_address?: string | null;
  is_active?: boolean | null;
};

type AssistantBody = {
  question?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function groupDuplicates(mosques: MosqueRow[]) {
  const groups = new Map<string, MosqueRow[]>();

  for (const mosque of mosques) {
    const key = [
      mosque.normalized_name ?? "",
      mosque.normalized_address ?? "",
      mosque.postcode ?? "",
    ].join("|");

    if (!key.replace(/\|/g, "").trim()) {
      continue;
    }

    const existing = groups.get(key) ?? [];
    existing.push(mosque);
    groups.set(key, existing);
  }

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .slice(0, 30);
}

async function buildAdminSnapshot() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [
    citiesResult,
    businessesResult,
    mosquesResult,
    prayerTimesResult,
    liveReportsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("cities")
      .select("id,name,slug,country,timezone,latitude,longitude,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(1000),

    supabaseAdmin
      .from("businesses")
      .select(
        "id,name,slug,city,category,phone,website,address,postcode,is_active,is_live,is_verified,featured,pricing_tier,paid_until"
      )
      .order("name", { ascending: true })
      .limit(1000),

    supabaseAdmin
      .from("mosques")
      .select(
        "id,name,slug,city,address,postcode,source,verified_status,normalized_name,normalized_address,is_active"
      )
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(1500),

    supabaseAdmin
      .from("city_prayer_times")
      .select("id,city_id,month,year")
      .eq("month", month)
      .eq("year", year)
      .limit(1500),

    supabaseAdmin
      .from("mosque_live_reports")
      .select("id,mosque_id,report_type,created_at")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  for (const result of [
    citiesResult,
    businessesResult,
    mosquesResult,
    prayerTimesResult,
    liveReportsResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const cities = citiesResult.data ?? [];
  const businesses = businessesResult.data ?? [];
  const mosques = (mosquesResult.data ?? []) as MosqueRow[];
  const prayerTimes = prayerTimesResult.data ?? [];
  const liveReports = liveReportsResult.data ?? [];

  const cityIdsWithPrayerTimes = new Set(
    prayerTimes.map((row) => String(row.city_id))
  );

  const citiesMissingCoordinates = cities.filter(
    (city) => city.latitude === null || city.longitude === null
  );

  const citiesMissingPrayerTimes = cities.filter(
    (city) => !cityIdsWithPrayerTimes.has(String(city.id))
  );

  const businessesMissingData = businesses.filter(
    (business) =>
      !business.phone ||
      !business.website ||
      !business.address ||
      !business.postcode
  );

  const inactiveOrNotLiveBusinesses = businesses.filter(
    (business) => !business.is_active || !business.is_live
  );

  const importedMosquesNeedingReview = mosques.filter((mosque) => {
    const source = (mosque.source ?? "").toLowerCase();
    const verifiedStatus = (mosque.verified_status ?? "").toLowerCase();

    return (
      source.includes("openstreetmap") ||
      source.includes("osm") ||
      verifiedStatus.includes("auto_imported")
    );
  });

  const duplicateMosqueGroups = groupDuplicates(mosques);

  const totalIssues =
    citiesMissingCoordinates.length +
    citiesMissingPrayerTimes.length +
    businessesMissingData.length +
    importedMosquesNeedingReview.length +
    duplicateMosqueGroups.length;

  const launchReadinessScore = Math.max(
    0,
    Math.min(100, 100 - Math.round(totalIssues / 4))
  );

  return {
    generated_at: new Date().toISOString(),
    current_month: month,
    current_year: year,
    launch_readiness: {
      score: launchReadinessScore,
      status:
        launchReadinessScore >= 85
          ? "Strong"
          : launchReadinessScore >= 65
            ? "Needs polish"
            : "Needs fixing before launch",
      issue_count: totalIssues,
    },
    totals: {
      cities: cities.length,
      mosques: mosques.length,
      businesses: businesses.length,
      live_reports_recent_sample: liveReports.length,
      current_month_prayer_timetable_rows: prayerTimes.length,
      possible_duplicate_mosque_groups: duplicateMosqueGroups.length,
      imported_mosques_needing_review: importedMosquesNeedingReview.length,
      businesses_missing_data: businessesMissingData.length,
      cities_missing_coordinates: citiesMissingCoordinates.length,
      cities_missing_prayer_times: citiesMissingPrayerTimes.length,
      inactive_or_not_live_businesses: inactiveOrNotLiveBusinesses.length,
    },
    issues: {
      cities_missing_coordinates: citiesMissingCoordinates.slice(0, 80),
      cities_missing_current_month_prayer_times:
        citiesMissingPrayerTimes.slice(0, 80),
      businesses_missing_phone_website_address_or_postcode:
        businessesMissingData.slice(0, 80),
      inactive_or_not_live_businesses: inactiveOrNotLiveBusinesses.slice(0, 80),
      imported_mosques_needing_review: importedMosquesNeedingReview.slice(
        0,
        80
      ),
      possible_duplicate_mosque_groups: duplicateMosqueGroups,
    },
  };
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

    const snapshot = await buildAdminSnapshot();

    return jsonResponse({
      ok: true,
      snapshot,
    });
  } catch (error) {
    console.error("ai-assistant GET error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected snapshot error.",
      },
      500
    );
  }
}

export async function POST(req: Request) {
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

    const body = (await req.json().catch(() => ({}))) as AssistantBody;
    const question =
      typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing question.",
        },
        400
      );
    }

    const snapshot = await buildAdminSnapshot();

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    if (!apiKey) {
      return jsonResponse({
        ok: true,
        answer:
          "OPENAI_API_KEY is missing. Add it to .env.local, restart npm run dev, and try again.",
        snapshot,
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You are SalahNearMe's read-only AI admin assistant. You inspect the provided database snapshot and answer admin questions. You must never claim to have changed data. You must only suggest actions. Prioritise launch-readiness, data quality, SEO, mosque duplicates, prayer times, halal businesses, trust signals, and practical next steps.",
          },
          {
            role: "user",
            content: `Admin question:\n${question}\n\nDatabase snapshot:\n${JSON.stringify(
              snapshot,
              null,
              2
            )}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error("OpenAI API error:", errorText);

      return jsonResponse(
        {
          ok: false,
          error: "OpenAI request failed.",
        },
        500
      );
    }

    const data = await response.json();

    const answer =
      data.output_text ??
      data.output?.[0]?.content?.[0]?.text ??
      "No answer returned.";

    return jsonResponse({
      ok: true,
      answer,
      snapshot,
    });
  } catch (error) {
    console.error("ai-assistant POST error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected assistant error.",
      },
      500
    );
  }
}


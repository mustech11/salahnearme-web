import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = ["approved", "rejected", "pending"] as const;

type ActionStatus = (typeof ALLOWED_STATUSES)[number];

type RequestBody = {
  mode?: unknown;
  action_id?: unknown;
  status?: unknown;
};

type MosqueForAction = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  address: string | null;
  postcode: string | null;
  source: string | null;
  verified_status: string | null;
  normalized_name: string | null;
  normalized_address: string | null;
  is_active: boolean | null;
};

type AdminActionInsert = {
  action_type: string;
  title: string;
  reason: string;
  risk_level: "low" | "medium" | "high";
  status: "pending";
  payload: Record<string, unknown>;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
      value.trim()
    )
  );
}

function isActionStatus(value: unknown): value is ActionStatus {
  return (
    typeof value === "string" &&
    ALLOWED_STATUSES.includes(value as ActionStatus)
  );
}

function getCurrentMonthYear() {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function duplicateKey(mosque: MosqueForAction) {
  return [
    mosque.normalized_name ?? "",
    mosque.normalized_address ?? "",
    mosque.postcode ?? "",
  ].join("|");
}

export async function GET() {
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

  const { data, error } = await supabaseAdmin
    .from("ai_admin_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("ai-actions GET error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not load AI admin actions.",
      },
      500
    );
  }

  return jsonResponse({
    ok: true,
    actions: data ?? [],
  });
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

    const body = (await req.json().catch(() => ({}))) as RequestBody;

    if (body.mode === "update_status") {
      if (!isUuid(body.action_id) || !isActionStatus(body.status)) {
        return jsonResponse(
          {
            ok: false,
            error: "Missing or invalid action_id/status.",
            allowed_statuses: ALLOWED_STATUSES,
          },
          400
        );
      }

      const update: Record<string, string | null> = {
        status: body.status,
        approved_at: null,
        rejected_at: null,
      };

      if (body.status === "approved") {
        update.approved_at = new Date().toISOString();
      }

      if (body.status === "rejected") {
        update.rejected_at = new Date().toISOString();
      }

      const { data, error } = await supabaseAdmin
        .from("ai_admin_actions")
        .update(update)
        .eq("id", body.action_id)
        .select("id, action_type, title, status, approved_at, rejected_at")
        .single();

      if (error) {
        console.error("ai-actions update_status error:", error);

        return jsonResponse(
          {
            ok: false,
            error: "Could not update action status.",
          },
          500
        );
      }

      return jsonResponse({
        ok: true,
        action: data,
      });
    }

    if (body.mode !== "generate") {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid mode.",
          allowed_modes: ["generate", "update_status"],
        },
        400
      );
    }

    const { month, year } = getCurrentMonthYear();

    const [citiesResult, businessesResult, mosquesResult, prayerTimesResult] =
      await Promise.all([
        supabaseAdmin
          .from("cities")
          .select("id,name,slug,country,timezone,latitude,longitude,is_active")
          .eq("is_active", true)
          .limit(1000),

        supabaseAdmin
          .from("businesses")
          .select(
            "id,name,slug,city,category,phone,website,address,postcode,is_active,is_live,is_verified"
          )
          .limit(1000),

        supabaseAdmin
          .from("mosques")
          .select(
            "id,name,slug,city,address,postcode,source,verified_status,normalized_name,normalized_address,is_active"
          )
          .eq("is_active", true)
          .limit(1500),

        supabaseAdmin
          .from("city_prayer_times")
          .select("id,city_id,month,year")
          .eq("month", month)
          .eq("year", year)
          .limit(1500),
      ]);

    for (const result of [
      citiesResult,
      businessesResult,
      mosquesResult,
      prayerTimesResult,
    ]) {
      if (result.error) {
        console.error("ai-actions generate lookup error:", result.error);

        return jsonResponse(
          {
            ok: false,
            error: "Could not generate AI admin actions.",
          },
          500
        );
      }
    }

    const cities = citiesResult.data ?? [];
    const businesses = businessesResult.data ?? [];
    const mosques = (mosquesResult.data ?? []) as MosqueForAction[];
    const prayerTimes = prayerTimesResult.data ?? [];

    const cityIdsWithPrayerTimes = new Set(
      prayerTimes.map((row) => String(row.city_id))
    );

    const actions: AdminActionInsert[] = [];

    for (const city of cities) {
      if (!cityIdsWithPrayerTimes.has(String(city.id))) {
        actions.push({
          action_type: "missing_prayer_times",
          title: `Add current month prayer times for ${city.name}`,
          reason: `${city.name} has no prayer timetable row for ${month}/${year}.`,
          risk_level: "medium",
          status: "pending",
          payload: {
            city_id: city.id,
            city_name: city.name,
            city_slug: city.slug,
            month,
            year,
          },
        });
      }

      if (city.latitude === null || city.longitude === null) {
        actions.push({
          action_type: "missing_city_coordinates",
          title: `Add coordinates for ${city.name}`,
          reason:
            "City has missing latitude/longitude. This affects prayer guidance, map view, distance sorting, and imports.",
          risk_level: "medium",
          status: "pending",
          payload: {
            city_id: city.id,
            city_name: city.name,
            city_slug: city.slug,
            country: city.country,
          },
        });
      }

      actions.push({
        action_type: "seo_page_suggestion",
        title: `Build SEO pages for ${city.name}`,
        reason:
          "City SEO pages can attract search traffic for prayer times, mosques, Jummah, Ramadan, and halal food.",
        risk_level: "low",
        status: "pending",
        payload: {
          city_id: city.id,
          city_name: city.name,
          city_slug: city.slug,
          suggested_pages: [
            `/${city.slug}/prayer-times`,
            `/${city.slug}/mosques-near-me`,
            `/${city.slug}/jummah-prayer`,
            `/${city.slug}/halal-food`,
            `/${city.slug}/ramadan-times`,
          ],
        },
      });
    }

    for (const business of businesses) {
      if (
        !business.phone ||
        !business.website ||
        !business.address ||
        !business.postcode
      ) {
        actions.push({
          action_type: "business_data_improvement",
          title: `Improve business listing: ${
            business.name ?? "Unnamed business"
          }`,
          reason:
            "Business is missing phone, website, address, or postcode. This reduces user trust and conversion.",
          risk_level: "low",
          status: "pending",
          payload: {
            business_id: business.id,
            name: business.name,
            slug: business.slug,
            city: business.city,
            missing: {
              phone: !business.phone,
              website: !business.website,
              address: !business.address,
              postcode: !business.postcode,
            },
          },
        });
      }
    }

    const duplicateMap = new Map<string, MosqueForAction[]>();

    for (const mosque of mosques) {
      const key = duplicateKey(mosque);

      if (!key.replace(/\|/g, "").trim()) {
        continue;
      }

      const existing = duplicateMap.get(key) ?? [];
      existing.push(mosque);
      duplicateMap.set(key, existing);
    }

    for (const group of duplicateMap.values()) {
      if (group.length > 1) {
        actions.push({
          action_type: "duplicate_mosque_review",
          title: `Review possible duplicate mosque: ${
            group[0]?.name ?? "Unnamed mosque"
          }`,
          reason:
            "Multiple mosque records share the same normalised name/address/postcode. Admin should review before merging.",
          risk_level: "high",
          status: "pending",
          payload: {
            records: group.map((mosque) => ({
              id: mosque.id,
              name: mosque.name,
              slug: mosque.slug,
              city: mosque.city,
              address: mosque.address,
              postcode: mosque.postcode,
              source: mosque.source,
              verified_status: mosque.verified_status,
            })),
          },
        });
      }
    }

    for (const mosque of mosques) {
      const source = (mosque.source ?? "").toLowerCase();
      const verifiedStatus = (mosque.verified_status ?? "").toLowerCase();

      if (
        source.includes("openstreetmap") ||
        source.includes("osm") ||
        verifiedStatus.includes("auto_imported")
      ) {
        actions.push({
          action_type: "imported_mosque_review",
          title: `Review imported mosque: ${mosque.name ?? "Unnamed mosque"}`,
          reason:
            "Imported mosque should be checked for accuracy, duplicate risk, address quality, and verification status.",
          risk_level: "medium",
          status: "pending",
          payload: {
            mosque_id: mosque.id,
            name: mosque.name,
            slug: mosque.slug,
            city: mosque.city,
            address: mosque.address,
            postcode: mosque.postcode,
            source: mosque.source,
            verified_status: mosque.verified_status,
          },
        });
      }
    }

    const limitedActions = actions.slice(0, 300);

    const { error: deleteError } = await supabaseAdmin
      .from("ai_admin_actions")
      .delete()
      .eq("status", "pending");

    if (deleteError) {
      console.error("ai-actions delete pending error:", deleteError);

      return jsonResponse(
        {
          ok: false,
          error: "Could not clear old pending actions.",
        },
        500
      );
    }

    if (limitedActions.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("ai_admin_actions")
        .insert(limitedActions);

      if (insertError) {
        console.error("ai-actions insert error:", insertError);

        return jsonResponse(
          {
            ok: false,
            error: "Could not insert generated actions.",
          },
          500
        );
      }
    }

    return jsonResponse({
      ok: true,
      inserted: limitedActions.length,
      generated: actions.length,
    });
  } catch (error) {
    console.error("ai-actions route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not process AI admin action request.",
      },
      500
    );
  }
}


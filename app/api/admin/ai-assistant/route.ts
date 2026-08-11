import {
  NextResponse,
} from "next/server";

import {
  requireAdmin,
} from "@/lib/adminAuth";

import {
  AICoreError,
  runAI,
} from "@/lib/aiCore";

import {
  ADMIN_ASSISTANT_JSON_SCHEMA,
  adminAssistantResponseSchema,
} from "@/lib/aiSchemas";

import {
  supabaseAdmin,
} from "@/lib/supabaseAdmin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

const MAX_QUESTION_LENGTH =
  2_000;

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  address: string | null;
  postcode: string | null;
  source: string | null;
  verified_status:
    | string
    | null;
  normalized_name?:
    | string
    | null;
  normalized_address?:
    | string
    | null;
  is_active?:
    | boolean
    | null;
};

type AssistantBody = {
  question?: unknown;
};

function jsonResponse(
  body: Record<
    string,
    unknown
  >,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    }
  );
}

function cleanQuestion(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .replace(
          /\s+/g,
          " "
        )
        .slice(
          0,
          MAX_QUESTION_LENGTH
        )
    : "";
}

function groupDuplicates(
  mosques: MosqueRow[]
) {
  const groups =
    new Map<
      string,
      MosqueRow[]
    >();

  for (
    const mosque of mosques
  ) {
    const key = [
      mosque.normalized_name ??
        "",
      mosque.normalized_address ??
        "",
      mosque.postcode ?? "",
    ].join("|");

    if (
      !key
        .replace(
          /\|/g,
          ""
        )
        .trim()
    ) {
      continue;
    }

    const existing =
      groups.get(key) ?? [];

    existing.push(mosque);

    groups.set(
      key,
      existing
    );
  }

  return Array.from(
    groups.values()
  )
    .filter(
      (group) =>
        group.length > 1
    )
    .slice(0, 30);
}

async function buildAdminSnapshot() {
  const now =
    new Date();

  const month =
    now.getMonth() + 1;

  const year =
    now.getFullYear();

  const [
    citiesResult,
    businessesResult,
    mosquesResult,
    prayerTimesResult,
    liveReportsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("cities")
      .select(
        "id,name,slug,country,timezone,latitude,longitude,is_active"
      )
      .eq(
        "is_active",
        true
      )
      .order(
        "name",
        {
          ascending:
            true,
        }
      )
      .limit(1000),

    supabaseAdmin
      .from(
        "businesses"
      )
      .select(
        "id,name,slug,city,category,phone,website,address,postcode,is_active,is_live,is_verified,featured,pricing_tier,paid_until"
      )
      .order(
        "name",
        {
          ascending:
            true,
        }
      )
      .limit(1000),

    supabaseAdmin
      .from("mosques")
      .select(
        "id,name,slug,city,address,postcode,source,verified_status,normalized_name,normalized_address,is_active"
      )
      .eq(
        "is_active",
        true
      )
      .order(
        "name",
        {
          ascending:
            true,
        }
      )
      .limit(1500),

    supabaseAdmin
      .from(
        "city_prayer_times"
      )
      .select(
        "id,city_id,month,year"
      )
      .eq(
        "month",
        month
      )
      .eq(
        "year",
        year
      )
      .limit(1500),

    supabaseAdmin
      .from(
        "mosque_live_reports"
      )
      .select(
        "id,mosque_id,report_type,created_at"
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      )
      .limit(300),
  ]);

  const results = [
    citiesResult,
    businessesResult,
    mosquesResult,
    prayerTimesResult,
    liveReportsResult,
  ];

  for (
    const result of results
  ) {
    if (
      result.error
    ) {
      throw new Error(
        result.error.message
      );
    }
  }

  const cities =
    citiesResult.data ?? [];

  const businesses =
    businessesResult.data ??
    [];

  const mosques =
    (mosquesResult.data ??
      []) as MosqueRow[];

  const prayerTimes =
    prayerTimesResult.data ??
    [];

  const liveReports =
    liveReportsResult.data ??
    [];

  const cityIdsWithPrayerTimes =
    new Set(
      prayerTimes.map(
        (row) =>
          String(
            row.city_id
          )
      )
    );

  const citiesMissingCoordinates =
    cities.filter(
      (city) =>
        city.latitude ===
          null ||
        city.longitude ===
          null
    );

  const citiesMissingPrayerTimes =
    cities.filter(
      (city) =>
        !cityIdsWithPrayerTimes.has(
          String(city.id)
        )
    );

  const businessesMissingData =
    businesses.filter(
      (business) =>
        !business.phone ||
        !business.website ||
        !business.address ||
        !business.postcode
    );

  const inactiveOrNotLiveBusinesses =
    businesses.filter(
      (business) =>
        !business.is_active ||
        !business.is_live
    );

  const importedMosquesNeedingReview =
    mosques.filter(
      (mosque) => {
        const source =
          (
            mosque.source ??
            ""
          ).toLowerCase();

        const verifiedStatus =
          (
            mosque.verified_status ??
            ""
          ).toLowerCase();

        return (
          source.includes(
            "openstreetmap"
          ) ||
          source.includes(
            "osm"
          ) ||
          verifiedStatus.includes(
            "auto_imported"
          )
        );
      }
    );

  const duplicateMosqueGroups =
    groupDuplicates(
      mosques
    );

  const totalIssues =
    citiesMissingCoordinates.length +
    citiesMissingPrayerTimes.length +
    businessesMissingData.length +
    importedMosquesNeedingReview.length +
    duplicateMosqueGroups.length;

  const launchReadinessScore =
    Math.max(
      0,
      Math.min(
        100,
        100 -
          Math.round(
            totalIssues /
              4
          )
      )
    );

  return {
    generated_at:
      new Date().toISOString(),

    current_month:
      month,

    current_year:
      year,

    launch_readiness: {
      score:
        launchReadinessScore,

      status:
        launchReadinessScore >=
        85
          ? "Strong"
          : launchReadinessScore >=
              65
            ? "Needs polish"
            : "Needs fixing before launch",

      issue_count:
        totalIssues,
    },

    totals: {
      cities:
        cities.length,

      mosques:
        mosques.length,

      businesses:
        businesses.length,

      live_reports_recent_sample:
        liveReports.length,

      current_month_prayer_timetable_rows:
        prayerTimes.length,

      possible_duplicate_mosque_groups:
        duplicateMosqueGroups.length,

      imported_mosques_needing_review:
        importedMosquesNeedingReview.length,

      businesses_missing_data:
        businessesMissingData.length,

      cities_missing_coordinates:
        citiesMissingCoordinates.length,

      cities_missing_prayer_times:
        citiesMissingPrayerTimes.length,

      inactive_or_not_live_businesses:
        inactiveOrNotLiveBusinesses.length,
    },

    issues: {
      cities_missing_coordinates:
        citiesMissingCoordinates.slice(
          0,
          40
        ),

      cities_missing_current_month_prayer_times:
        citiesMissingPrayerTimes.slice(
          0,
          40
        ),

      businesses_missing_phone_website_address_or_postcode:
        businessesMissingData.slice(
          0,
          40
        ),

      inactive_or_not_live_businesses:
        inactiveOrNotLiveBusinesses.slice(
          0,
          40
        ),

      imported_mosques_needing_review:
        importedMosquesNeedingReview.slice(
          0,
          40
        ),

      possible_duplicate_mosque_groups:
        duplicateMosqueGroups.slice(
          0,
          20
        ),
    },
  };
}

export async function GET() {
  try {
    const permission =
      await requireAdmin();

    if (
      !permission.ok
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            permission.error,
        },
        permission.status
      );
    }

    const snapshot =
      await buildAdminSnapshot();

    return jsonResponse({
      ok: true,
      snapshot,
    });
  } catch (error) {
    console.error(
      "ai-assistant GET error:",
      error
    );

    return jsonResponse(
      {
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unexpected snapshot error.",
      },
      500
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const permission =
      await requireAdmin();

    if (
      !permission.ok
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            permission.error,
        },
        permission.status
      );
    }

    const body =
      (await request
        .json()
        .catch(
          () => ({})
        )) as AssistantBody;

    const question =
      cleanQuestion(
        body.question
      );

    if (!question) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing question.",
        },
        400
      );
    }

    const snapshot =
      await buildAdminSnapshot();

    const result =
  await runAI({
    schema:
      adminAssistantResponseSchema,

    structuredOutput: {
      name:
        "salahnearme_admin_intelligence",

      description:
        "Structured operational intelligence for the authorised SalahNearMe administrator.",

      schema:
        ADMIN_ASSISTANT_JSON_SCHEMA,

      strict:
        true,
    },

    timeoutMs:
      30_000,

        maxOutputTokens:
          2_500,

        metadata: {
          feature:
            "admin_assistant",

          platform:
            "salahnearme",
        },

        messages: [
          {
            role: "system",

            content: `
You are the SalahNearMe Operations Intelligence Assistant.

SalahNearMe is a Muslim ecosystem platform covering mosques, prayer intelligence, halal businesses, travel, Hajj, Umrah, community information and platform operations.

You are strictly READ-ONLY.

Never claim that you changed, deleted, inserted, merged, approved, rejected or updated any data.

Your job is to analyse the supplied operational snapshot and help an authorised administrator make better decisions.

Prioritise:

1. Prayer-time reliability.
2. Mosque accuracy and trust.
3. Duplicate mosque risk.
4. Imported mosque verification.
5. Halal business data quality.
6. City launch readiness.
7. SEO and organic growth.
8. User trust.
9. Platform reliability.
10. Practical actions with the highest impact.

Do not invent database facts.

If information is unavailable, say so clearly.

Return ONLY valid JSON using this shape:

{
  "answer": "Detailed answer to the administrator",
  "summary": "Short operational summary",
  "confidence": 0,
  "risk_level": "info",
  "recommendations": [
    {
      "title": "Recommendation",
      "reason": "Why it matters",
      "priority": "medium",
      "category": "operations",
      "suggested_action": "What the administrator should consider doing"
    }
  ],
  "requires_admin_action": false
}
`.trim(),
          },

          {
            role: "user",

            content: `
ADMIN QUESTION

${question}

SALAHNEARME OPERATIONAL SNAPSHOT

${JSON.stringify(
  snapshot
)}
`.trim(),
          },
        ],
      });

    const structured =
  result.parsed;

if (!structured) {
  throw new AICoreError(
    "No validated structured intelligence was returned.",
    {
      status: 502,
      code:
        "MISSING_STRUCTURED_INTELLIGENCE",
    }
  );
}

return jsonResponse({
  ok: true,

  answer:
    structured.answer,

      intelligence:
        structured,

      snapshot,

      ai: {
        model:
          result.model,

        response_id:
          result.responseId,

        duration_ms:
          result.durationMs,

        usage:
          result.usage,
      },
    });
  } catch (error) {
    console.error(
      "ai-assistant POST error:",
      error
    );

    if (
      error instanceof
      AICoreError
    ) {
      return jsonResponse(
        {
          ok: false,

          error:
            error.message,

          code:
            error.code,
        },
        Math.min(
          599,
          Math.max(
            400,
            error.status
          )
        )
      );
    }

    return jsonResponse(
      {
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unexpected assistant error.",
      },
      500
    );
  }
}
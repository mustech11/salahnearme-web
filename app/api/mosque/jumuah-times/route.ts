import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_SESSIONS = 8;
const MAX_LABEL_LENGTH = 80;
const MAX_NOTES_LENGTH = 500;

type RequestBody = {
  id?: unknown;
  mosque_id?: unknown;
  label?: unknown;
  khutbah_time?: unknown;
  salah_time?: unknown;
  active?: unknown;
  notes?: unknown;
};

type ParsedTime = {
  value: string | null;
  valid: boolean;
};

type DatabaseError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function cleanSingleLineText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return cleaned || null;
}

function cleanMultilineText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);

  return cleaned || null;
}

function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

function parseBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function parseNullableTime(value: unknown): ParsedTime {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return {
      value: null,
      valid: true,
    };
  }

  if (typeof value !== "string") {
    return {
      value: null,
      valid: false,
    };
  }

  const cleaned = value.trim();

  const match = cleaned.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    return {
      value: null,
      valid: false,
    };
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? "0");

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return {
      value: null,
      valid: false,
    };
  }

  return {
    value: `${match[1]}:${match[2]}:00`,
    valid: true,
  };
}

function timeToMinutes(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{2}):(\d{2}):\d{2}$/);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function getDatabaseErrorResponse(
  error: DatabaseError,
  fallbackMessage: string
) {
  console.error(fallbackMessage, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  if (error.code === "23505") {
    return jsonResponse(
      {
        ok: false,
        error:
          "An active Jumu’ah session already exists with these details.",
      },
      409
    );
  }

  if (error.code === "23503") {
    return jsonResponse(
      {
        ok: false,
        error: "The selected mosque could not be found.",
      },
      400
    );
  }

  if (error.code === "23502") {
    return jsonResponse(
      {
        ok: false,
        error: "A required Jumu’ah session field is missing.",
      },
      400
    );
  }

  return jsonResponse(
    {
      ok: false,
      error: fallbackMessage,
    },
    500
  );
}

async function findDuplicateActiveTime({
  mosqueId,
  salahTime,
  excludeId,
}: {
  mosqueId: string;
  salahTime: string;
  excludeId?: string | null;
}) {
  let query = supabaseAdmin
    .from("mosque_jumuah_times")
    .select("id, label, salah_time")
    .eq("mosque_id", mosqueId)
    .eq("active", true)
    .eq("salah_time", salahTime)
    .limit(1);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getSessionCount(mosqueId: string) {
  const { count, error } = await supabaseAdmin
    .from("mosque_jumuah_times")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("mosque_id", mosqueId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const mosqueId = cleanSingleLineText(
      searchParams.get("mosque_id"),
      80
    );

    const includeInactive =
      searchParams.get("include_inactive") === "true";

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        400
      );
    }

    /*
     * Active Jumu’ah times may be loaded publicly.
     * Inactive records are management data and require permission.
     */
    if (includeInactive) {
      const permission = await requireMosqueManager(mosqueId);

      if (!permission.ok) {
        return jsonResponse(
          {
            ok: false,
            error: permission.error,
          },
          permission.status
        );
      }
    }

    let query = supabaseAdmin
      .from("mosque_jumuah_times")
      .select(
        [
          "id",
          "mosque_id",
          "label",
          "khutbah_time",
          "salah_time",
          "active",
          "notes",
          "created_at",
          "updated_at",
        ].join(", ")
      )
      .eq("mosque_id", mosqueId)
      .order("salah_time", {
        ascending: true,
        nullsFirst: false,
      })
      .order("created_at", {
        ascending: true,
      });

    if (!includeInactive) {
      query = query
        .eq("active", true)
        .not("salah_time", "is", null);
    }

    const { data, error } = await query;

    if (error) {
      return getDatabaseErrorResponse(
        error,
        "Could not load Jumu’ah times."
      );
    }

    return jsonResponse({
      ok: true,
      count: data?.length ?? 0,
      jumuah_times: data ?? [],
    });
  } catch (error) {
    console.error("Unexpected Jumu’ah times GET error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not load Jumu’ah times.",
      },
      500
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request
      .json()
      .catch(() => null)) as RequestBody | null;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid JSON body.",
        },
        400
      );
    }

    const id = cleanSingleLineText(body.id, 80);
    const mosqueId = cleanSingleLineText(body.mosque_id, 80);
    const label =
      cleanSingleLineText(body.label, MAX_LABEL_LENGTH) ??
      "Jumu’ah";

    const notes = cleanMultilineText(
      body.notes,
      MAX_NOTES_LENGTH
    );

    const active = parseBoolean(body.active, true);
    const parsedKhutbahTime = parseNullableTime(body.khutbah_time);
    const parsedSalahTime = parseNullableTime(body.salah_time);

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        400
      );
    }

    if (id && !isUuid(id)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid Jumu’ah time id.",
        },
        400
      );
    }

    const permission = await requireMosqueManager(mosqueId);

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error: permission.error,
        },
        permission.status
      );
    }

    if (!parsedKhutbahTime.valid) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Khutbah time must be a valid 24-hour time.",
        },
        400
      );
    }

    if (!parsedSalahTime.valid) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Salah time must be a valid 24-hour time.",
        },
        400
      );
    }

    /*
     * Active sessions must always have a salah time.
     * A saved session may be made inactive with a null time.
     */
    if (active && !parsedSalahTime.value) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Salah time is required for an active Jumu’ah session.",
        },
        400
      );
    }

    if (
      parsedKhutbahTime.value &&
      !parsedSalahTime.value
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "A salah time is required when a khutbah time is provided.",
        },
        400
      );
    }

    const khutbahMinutes = timeToMinutes(
      parsedKhutbahTime.value
    );

    const salahMinutes = timeToMinutes(
      parsedSalahTime.value
    );

    if (
      khutbahMinutes !== null &&
      salahMinutes !== null &&
      khutbahMinutes > salahMinutes
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Khutbah time cannot be later than the salah time.",
        },
        400
      );
    }

    /*
     * Prevent two active sessions from using the same salah time.
     */
    if (active && parsedSalahTime.value) {
      try {
        const duplicate = await findDuplicateActiveTime({
          mosqueId,
          salahTime: parsedSalahTime.value,
          excludeId: id,
        });

        if (duplicate) {
          return jsonResponse(
            {
              ok: false,
              error: `${
                duplicate.label || "Another active session"
              } already uses this salah time.`,
            },
            409
          );
        }
      } catch (error) {
        return getDatabaseErrorResponse(
          error as DatabaseError,
          "Could not validate the Jumu’ah session."
        );
      }
    }

    const now = new Date().toISOString();

    const updatePayload = {
      label,
      khutbah_time: parsedKhutbahTime.value,
      salah_time: parsedSalahTime.value,
      active,
      notes,
      updated_at: now,
    };

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("mosque_jumuah_times")
        .update(updatePayload)
        .eq("id", id)
        .eq("mosque_id", mosqueId)
        .select(
          [
            "id",
            "mosque_id",
            "label",
            "khutbah_time",
            "salah_time",
            "active",
            "notes",
            "created_at",
            "updated_at",
          ].join(", ")
        )
        .maybeSingle();

      if (error) {
        return getDatabaseErrorResponse(
          error,
          "Could not update the Jumu’ah session."
        );
      }

      if (!data) {
        return jsonResponse(
          {
            ok: false,
            error:
              "The Jumu’ah session was not found for this mosque.",
          },
          404
        );
      }

      return jsonResponse({
        ok: true,
        jumuah_time: data,
        message: "Jumu’ah session updated successfully.",
      });
    }

    /*
     * Limit each mosque to eight retained Jumu’ah records.
     */
    try {
      const sessionCount = await getSessionCount(mosqueId);

      if (sessionCount >= MAX_SESSIONS) {
        return jsonResponse(
          {
            ok: false,
            error: `A mosque can have a maximum of ${MAX_SESSIONS} Jumu’ah sessions.`,
          },
          409
        );
      }
    } catch (error) {
      return getDatabaseErrorResponse(
        error as DatabaseError,
        "Could not validate the Jumu’ah session limit."
      );
    }

    const insertPayload = {
      mosque_id: mosqueId,
      ...updatePayload,
      created_at: now,
    };

    const { data, error } = await supabaseAdmin
      .from("mosque_jumuah_times")
      .insert(insertPayload)
      .select(
        [
          "id",
          "mosque_id",
          "label",
          "khutbah_time",
          "salah_time",
          "active",
          "notes",
          "created_at",
          "updated_at",
        ].join(", ")
      )
      .single();

    if (error) {
      return getDatabaseErrorResponse(
        error,
        "Could not create the Jumu’ah session."
      );
    }

    return jsonResponse(
      {
        ok: true,
        jumuah_time: data,
        message: "Jumu’ah session created successfully.",
      },
      201
    );
  } catch (error) {
    console.error("Unexpected Jumu’ah times POST error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not save the Jumu’ah session.",
      },
      500
    );
  }
}
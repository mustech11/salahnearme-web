import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { canManageMosque } from "@/lib/mosquePermissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Body = {
  mosque_id?: unknown;
  payload?: unknown;
};

type JumuahTimeField =
  | "jumuah_khutbah_1"
  | "jumuah_salah_1"
  | "jumuah_khutbah_2"
  | "jumuah_salah_2"
  | "jumuah_khutbah_3"
  | "jumuah_salah_3";

type CityPrayerTimeField =
  | "fajr_start"
  | "sunrise"
  | "dhuhr_start"
  | "asr_start"
  | "maghrib_start"
  | "isha_start";

type TimeField =
  | JumuahTimeField
  | CityPrayerTimeField;

type TextFieldName =
  | "name"
  | "area"
  | "city"
  | "address"
  | "jumuah_notes";

type TextFieldDefinition = {
  field: TextFieldName;
  label: string;
  maxLength: number;
  multiline?: boolean;
};

type MosqueRow = {
  id: string;
  city: string | null;
  city_id: number | null;

  jumuah_enabled: boolean | null;
  jumuah_khutbah_1: string | null;
  jumuah_salah_1: string | null;
  jumuah_khutbah_2: string | null;
  jumuah_salah_2: string | null;
  jumuah_khutbah_3: string | null;
  jumuah_salah_3: string | null;
};

type UpdatedMosqueRow = {
  id: string;
  name: string | null;
  city: string | null;
  updated_at: string | null;
};

type CityRow = {
  id: number;
  name: string | null;
};

type ParsedTimeResult =
  | {
      ok: true;
      value: string | null;
    }
  | {
      ok: false;
      error: string;
    };

type CityResolution =
  | {
      id: number;
      warning: null;
    }
  | {
      id: null;
      warning: string;
    };

type OptionalTextResult =
  | {
      ok: true;
      provided: false;
    }
  | {
      ok: true;
      provided: true;
      value: string | null;
    }
  | {
      ok: false;
      error: string;
    };

type OptionalUrlResult =
  | {
      ok: true;
      provided: false;
    }
  | {
      ok: true;
      provided: true;
      value: string | null;
    }
  | {
      ok: false;
      error: string;
    };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TIME_REGEX =
  /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

const MAX_NAME_LENGTH = 180;
const MAX_AREA_LENGTH = 120;
const MAX_CITY_LENGTH = 120;
const MAX_POSTCODE_LENGTH = 20;
const MAX_ADDRESS_LENGTH = 500;
const MAX_NOTES_LENGTH = 2_000;
const MAX_URL_LENGTH = 2_048;

const JUMUAH_TIME_FIELDS = [
  "jumuah_khutbah_1",
  "jumuah_salah_1",
  "jumuah_khutbah_2",
  "jumuah_salah_2",
  "jumuah_khutbah_3",
  "jumuah_salah_3",
] as const satisfies readonly JumuahTimeField[];

const CITY_PRAYER_TIME_FIELDS = [
  "fajr_start",
  "sunrise",
  "dhuhr_start",
  "asr_start",
  "maghrib_start",
  "isha_start",
] as const satisfies readonly CityPrayerTimeField[];

const TEXT_FIELDS: readonly TextFieldDefinition[] = [
  {
    field: "name",
    label: "Mosque name",
    maxLength: MAX_NAME_LENGTH,
  },
  {
    field: "area",
    label: "Area",
    maxLength: MAX_AREA_LENGTH,
  },
  {
    field: "city",
    label: "City",
    maxLength: MAX_CITY_LENGTH,
  },
  {
    field: "address",
    label: "Address",
    maxLength: MAX_ADDRESS_LENGTH,
  },
  {
    field: "jumuah_notes",
    label: "Jumu’ah notes",
    maxLength: MAX_NOTES_LENGTH,
    multiline: true,
  },
];

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value)
  );
}

function isJsonRequest(request: Request): boolean {
  const contentType =
    request.headers.get("content-type")?.toLowerCase() ?? "";

  return contentType.includes("application/json");
}

async function readBody(
  request: Request
): Promise<Body | null> {
  try {
    const value: unknown = await request.json();

    return isPlainObject(value)
      ? (value as Body)
      : null;
  } catch {
    return null;
  }
}

function cleanSingleLine(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .trim()
    .replace(/\s+/g, " ");

  return cleaned || null;
}

function cleanMultiline(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/\r\n?/g, "\n")
    .trim();

  return cleaned || null;
}

function isUuid(
  value: string | null
): value is string {
  return Boolean(
    value &&
      UUID_REGEX.test(value)
  );
}

function hasOwn(
  object: Record<string, unknown>,
  key: string
): boolean {
  return Object.prototype.hasOwnProperty.call(
    object,
    key
  );
}

function validateOptionalText({
  payload,
  field,
  label,
  maxLength,
  multiline = false,
}: {
  payload: Record<string, unknown>;
  field: TextFieldName | "postcode";
  label: string;
  maxLength: number;
  multiline?: boolean;
}): OptionalTextResult {
  if (!hasOwn(payload, field)) {
    return {
      ok: true,
      provided: false,
    };
  }

  const rawValue = payload[field];

  if (
    rawValue !== null &&
    rawValue !== undefined &&
    typeof rawValue !== "string"
  ) {
    return {
      ok: false,
      error: `${label} must be text.`,
    };
  }

  const cleaned = multiline
    ? cleanMultiline(rawValue)
    : cleanSingleLine(rawValue);

  if (
    cleaned &&
    cleaned.length > maxLength
  ) {
    return {
      ok: false,
      error: `${label} must not exceed ${maxLength.toLocaleString()} characters.`,
    };
  }

  return {
    ok: true,
    provided: true,
    value: cleaned,
  };
}

function parseTimeField(
  payload: Record<string, unknown>,
  field: TimeField,
  label: string
):
  | {
      provided: false;
      result: null;
    }
  | {
      provided: true;
      result: ParsedTimeResult;
    } {
  if (!hasOwn(payload, field)) {
    return {
      provided: false,
      result: null,
    };
  }

  const value = payload[field];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return {
      provided: true,
      result: {
        ok: true,
        value: null,
      },
    };
  }

  if (typeof value !== "string") {
    return {
      provided: true,
      result: {
        ok: false,
        error: `${label} must use 24-hour HH:MM format.`,
      },
    };
  }

  const cleaned = value.trim();
  const match = TIME_REGEX.exec(cleaned);

  if (!match) {
    return {
      provided: true,
      result: {
        ok: false,
        error: `${label} must use 24-hour HH:MM format.`,
      },
    };
  }

  return {
    provided: true,
    result: {
      ok: true,
      value: `${match[1]}:${match[2]}`,
    },
  };
}

function normaliseUrl(
  value: string
): string {
  return /^https?:\/\//i.test(value)
    ? value
    : `https://${value}`;
}

function validateUrl(
  payload: Record<string, unknown>
): OptionalUrlResult {
  if (!hasOwn(payload, "maps_url")) {
    return {
      ok: true,
      provided: false,
    };
  }

  const rawValue = payload.maps_url;

  if (
    rawValue !== null &&
    rawValue !== undefined &&
    typeof rawValue !== "string"
  ) {
    return {
      ok: false,
      error: "Maps URL must be text.",
    };
  }

  const cleaned =
    cleanSingleLine(rawValue);

  if (!cleaned) {
    return {
      ok: true,
      provided: true,
      value: null,
    };
  }

  if (cleaned.length > MAX_URL_LENGTH) {
    return {
      ok: false,
      error: `Maps URL must not exceed ${MAX_URL_LENGTH.toLocaleString()} characters.`,
    };
  }

  try {
    const url = new URL(
      normaliseUrl(cleaned)
    );

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return {
        ok: false,
        error:
          "Maps URL must use HTTP or HTTPS.",
      };
    }

    if (!url.hostname) {
      return {
        ok: false,
        error: "Enter a valid maps URL.",
      };
    }

    const normalised = url.toString();

    if (
      normalised.length > MAX_URL_LENGTH
    ) {
      return {
        ok: false,
        error: `Maps URL must not exceed ${MAX_URL_LENGTH.toLocaleString()} characters.`,
      };
    }

    return {
      ok: true,
      provided: true,
      value: normalised,
    };
  } catch {
    return {
      ok: false,
      error: "Enter a valid maps URL.",
    };
  }
}

function sameCity(
  first: string | null,
  second: string | null
): boolean {
  const firstCity =
    cleanSingleLine(first);
  const secondCity =
    cleanSingleLine(second);

  if (!firstCity || !secondCity) {
    return false;
  }

  return (
    firstCity.toLocaleLowerCase("en-GB") ===
    secondCity.toLocaleLowerCase("en-GB")
  );
}

function formatFieldLabel(
  field: TimeField
): string {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

async function resolveCityId({
  currentMosque,
  effectiveCity,
}: {
  currentMosque: MosqueRow;
  effectiveCity: string;
}): Promise<CityResolution> {
  if (
    typeof currentMosque.city_id === "number" &&
    Number.isInteger(currentMosque.city_id) &&
    currentMosque.city_id > 0 &&
    sameCity(
      currentMosque.city,
      effectiveCity
    )
  ) {
    return {
      id: currentMosque.city_id,
      warning: null,
    };
  }

  const { data, error } =
    await supabaseAdmin
      .from("cities")
      .select("id,name")
      .eq("is_active", true)
      .ilike("name", effectiveCity)
      .limit(2);

  if (error) {
    console.error(
      "Save-settings city lookup failed:",
      {
        mosqueId: currentMosque.id,
        code: error.code,
        message: error.message,
      }
    );

    return {
      id: null,
      warning:
        "Mosque settings were saved, but the city prayer-time record could not be located.",
    };
  }

  const rows =
    (data ?? []) as CityRow[];

  if (rows.length === 0) {
    return {
      id: null,
      warning:
        "Mosque settings were saved, but no active matching city was found for the city prayer times.",
    };
  }

  if (rows.length > 1) {
    return {
      id: null,
      warning:
        "Mosque settings were saved, but the city name matched more than one city. The city prayer times were not changed.",
    };
  }

  const cityId = rows[0]?.id;

  if (
    typeof cityId !== "number" ||
    !Number.isInteger(cityId) ||
    cityId <= 0
  ) {
    return {
      id: null,
      warning:
        "Mosque settings were saved, but the matching city record was invalid.",
    };
  }

  return {
    id: cityId,
    warning: null,
  };
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route:
      "/api/dashboard/mosque/save-settings",
    method: "POST",
    body: {
      mosque_id: "required UUID",
      payload: {
        name:
          "optional text; required when supplied",
        area: "optional text",
        city: "optional text",
        postcode: "optional text",
        address: "optional text",
        maps_url:
          "optional HTTP or HTTPS URL",
        jumuah_enabled:
          "optional boolean",
        jumuah_khutbah_1:
          "optional HH:MM",
        jumuah_salah_1:
          "optional HH:MM",
        jumuah_khutbah_2:
          "optional HH:MM",
        jumuah_salah_2:
          "optional HH:MM",
        jumuah_khutbah_3:
          "optional HH:MM",
        jumuah_salah_3:
          "optional HH:MM",
        jumuah_notes:
          "optional text",
        fajr_start:
          "optional HH:MM city fallback",
        sunrise:
          "optional HH:MM city fallback",
        dhuhr_start:
          "optional HH:MM city fallback",
        asr_start:
          "optional HH:MM city fallback",
        maghrib_start:
          "optional HH:MM city fallback",
        isha_start:
          "optional HH:MM city fallback",
      },
    },
  });
}

export async function POST(
  request: Request
) {
  try {
    if (!isJsonRequest(request)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Content-Type must be application/json.",
        },
        415
      );
    }

    const body =
      await readBody(request);

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Invalid JSON request body.",
        },
        400
      );
    }

    const mosqueId =
      cleanSingleLine(body.mosque_id);

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid mosque_id.",
        },
        400
      );
    }

    if (!isPlainObject(body.payload)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "A valid settings payload is required.",
        },
        400
      );
    }

    const payload =
      body.payload as Record<
        string,
        unknown
      >;

    const user = await requireUser();

    const email =
      cleanSingleLine(
        user.email
      )?.toLowerCase();

    if (!email) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorised.",
        },
        401
      );
    }

    const allowed =
      await canManageMosque(
        mosqueId,
        email
      );

    if (!allowed) {
      return jsonResponse(
        {
          ok: false,
          error:
            "You do not have permission to manage this mosque.",
        },
        403
      );
    }

    const {
      data: mosqueRaw,
      error: mosqueError,
    } = await supabaseAdmin
      .from("mosques")
      .select(
        `
        id,
        city,
        city_id,
        jumuah_enabled,
        jumuah_khutbah_1,
        jumuah_salah_1,
        jumuah_khutbah_2,
        jumuah_salah_2,
        jumuah_khutbah_3,
        jumuah_salah_3
      `
      )
      .eq("id", mosqueId)
      .maybeSingle();

    if (mosqueError) {
      console.error(
        "Save-settings mosque lookup failed:",
        {
          mosqueId,
          code: mosqueError.code,
          message:
            mosqueError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "The mosque settings could not be loaded.",
        },
        500
      );
    }

    if (!mosqueRaw) {
      return jsonResponse(
        {
          ok: false,
          error: "Mosque not found.",
        },
        404
      );
    }

    const mosque =
      mosqueRaw as MosqueRow;

    const validationErrors: string[] =
      [];

    const mosqueUpdate: Record<
      string,
      unknown
    > = {};

    for (const definition of TEXT_FIELDS) {
      const result =
        validateOptionalText({
          payload,
          field: definition.field,
          label: definition.label,
          maxLength:
            definition.maxLength,
          multiline:
            definition.multiline ??
            false,
        });

      if (!result.ok) {
        validationErrors.push(
          result.error
        );
        continue;
      }

      if (!result.provided) {
        continue;
      }

      if (
        definition.field === "name" &&
        !result.value
      ) {
        validationErrors.push(
          "Mosque name is required."
        );
        continue;
      }

      mosqueUpdate[
        definition.field
      ] = result.value;
    }

    const postcodeResult =
      validateOptionalText({
        payload,
        field: "postcode",
        label: "Postcode",
        maxLength:
          MAX_POSTCODE_LENGTH,
      });

    if (!postcodeResult.ok) {
      validationErrors.push(
        postcodeResult.error
      );
    } else if (
      postcodeResult.provided
    ) {
      mosqueUpdate.postcode =
        postcodeResult.value?.toUpperCase() ??
        null;
    }

    const mapsResult =
      validateUrl(payload);

    if (!mapsResult.ok) {
      validationErrors.push(
        mapsResult.error
      );
    } else if (
      mapsResult.provided
    ) {
      mosqueUpdate.maps_url =
        mapsResult.value;
    }

    if (
      hasOwn(
        payload,
        "jumuah_enabled"
      )
    ) {
      if (
        typeof payload.jumuah_enabled !==
        "boolean"
      ) {
        validationErrors.push(
          "Jumu’ah enabled must be true or false."
        );
      } else {
        mosqueUpdate.jumuah_enabled =
          payload.jumuah_enabled;
      }
    }

    const parsedTimes =
      new Map<
        TimeField,
        string | null
      >();

    for (
      const field of JUMUAH_TIME_FIELDS
    ) {
      const parsed =
        parseTimeField(
          payload,
          field,
          formatFieldLabel(field)
        );

      if (
        !parsed.provided ||
        !parsed.result
      ) {
        continue;
      }

      if (!parsed.result.ok) {
        validationErrors.push(
          parsed.result.error
        );
        continue;
      }

      parsedTimes.set(
        field,
        parsed.result.value
      );

      mosqueUpdate[field] =
        parsed.result.value;
    }

    for (
      const field of
        CITY_PRAYER_TIME_FIELDS
    ) {
      const parsed =
        parseTimeField(
          payload,
          field,
          formatFieldLabel(field)
        );

      if (
        !parsed.provided ||
        !parsed.result
      ) {
        continue;
      }

      if (!parsed.result.ok) {
        validationErrors.push(
          parsed.result.error
        );
        continue;
      }

      parsedTimes.set(
        field,
        parsed.result.value
      );
    }

    const effectiveJumuahEnabled =
      typeof mosqueUpdate.jumuah_enabled ===
      "boolean"
        ? mosqueUpdate.jumuah_enabled
        : mosque.jumuah_enabled ===
          true;

    if (effectiveJumuahEnabled) {
      const effectiveJumuahTimes =
        JUMUAH_TIME_FIELDS.map(
          (field) =>
            parsedTimes.has(field)
              ? parsedTimes.get(field) ??
                null
              : mosque[field]
        );

      if (
        !effectiveJumuahTimes.some(
          Boolean
        )
      ) {
        validationErrors.push(
          "Add at least one Jumu’ah khutbah or salah time while Jumu’ah management is enabled."
        );
      }
    }

    if (
      validationErrors.length > 0
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            validationErrors[0],
          errors:
            validationErrors,
        },
        422
      );
    }

    const hasMosqueUpdates =
      Object.keys(
        mosqueUpdate
      ).length > 0;

    const suppliedCityPrayerFields =
      CITY_PRAYER_TIME_FIELDS.filter(
        (field) =>
          parsedTimes.has(field)
      );

    if (
      !hasMosqueUpdates &&
      suppliedCityPrayerFields.length ===
        0
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "No mosque settings were supplied.",
        },
        400
      );
    }

    const now =
      new Date().toISOString();

    let updatedMosque: UpdatedMosqueRow | null =
      null;

    if (hasMosqueUpdates) {
      mosqueUpdate.updated_at = now;

      const {
        data: updatedMosqueRaw,
        error:
          updateMosqueError,
      } = await supabaseAdmin
        .from("mosques")
        .update(mosqueUpdate)
        .eq("id", mosqueId)
        .select(
          "id,name,city,updated_at"
        )
        .maybeSingle();

      if (updateMosqueError) {
        console.error(
          "Save-settings mosque update failed:",
          {
            mosqueId,
            code:
              updateMosqueError.code,
            message:
              updateMosqueError.message,
          }
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "The mosque settings could not be saved.",
          },
          500
        );
      }

      if (!updatedMosqueRaw) {
        return jsonResponse(
          {
            ok: false,
            error:
              "The mosque settings could not be updated. Refresh and try again.",
          },
          409
        );
      }

      updatedMosque =
        updatedMosqueRaw as UpdatedMosqueRow;
    }

    const hasCityPrayerTime =
      suppliedCityPrayerFields.some(
        (field) =>
          Boolean(
            parsedTimes.get(field)
          )
      );

    let cityPrayerTimesSaved =
      false;

    let warning:
      | string
      | null = null;

    if (hasCityPrayerTime) {
      const updatedCityValue =
        typeof mosqueUpdate.city ===
        "string"
          ? mosqueUpdate.city
          : null;

      const effectiveCity =
        cleanSingleLine(
          updatedCityValue ??
            mosque.city
        );

      if (!effectiveCity) {
        warning =
          "Mosque settings were saved, but city prayer times were not saved because no city is configured.";
      } else {
        const cityResolution =
          await resolveCityId({
            currentMosque: mosque,
            effectiveCity,
          });

        if (
          cityResolution.id === null
        ) {
          warning =
            cityResolution.warning;
        } else {
          const currentDate =
            new Date();

          const cityPrayerUpdate: Record<
            string,
            unknown
          > = {
            city_id:
              cityResolution.id,
            month:
              currentDate.getMonth() +
              1,
            year:
              currentDate.getFullYear(),
            source:
              "mosque_manager",
            updated_at: now,
          };

          for (
            const field of
              CITY_PRAYER_TIME_FIELDS
          ) {
            cityPrayerUpdate[field] =
              parsedTimes.has(field)
                ? parsedTimes.get(
                    field
                  ) ?? null
                : null;
          }

          const {
            error: prayerError,
          } = await supabaseAdmin
            .from(
              "city_prayer_times"
            )
            .upsert(
              cityPrayerUpdate,
              {
                onConflict:
                  "city_id,month,year",
                ignoreDuplicates:
                  false,
              }
            );

          if (prayerError) {
            console.error(
              "Save-settings city prayer upsert failed:",
              {
                mosqueId,
                cityId:
                  cityResolution.id,
                code:
                  prayerError.code,
                message:
                  prayerError.message,
              }
            );

            warning =
              "Mosque settings were saved, but the city prayer times could not be updated.";
          } else {
            cityPrayerTimesSaved =
              true;
          }
        }
      }
    }

    const message = warning
      ? warning
      : cityPrayerTimesSaved
        ? "Mosque settings and city prayer times saved successfully."
        : "Mosque settings saved successfully.";

    return jsonResponse({
      ok: true,
      mosque_id: mosqueId,
      city_prayer_times_saved:
        cityPrayerTimesSaved,
      warning,
      message,
      mosque: updatedMosque,
    });
  } catch (error) {
    console.error(
      "Save mosque settings route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "The mosque settings could not be saved.",
      },
      500
    );
  }
}
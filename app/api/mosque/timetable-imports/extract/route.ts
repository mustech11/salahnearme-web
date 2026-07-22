import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  import_id?: unknown;
};

type TimetableImportRow = {
  id: string;
  mosque_id: string | null;
  source_id: string | null;
  source_url: string | null;
  source_type: string | null;
};

type SourceType = "website" | "pdf" | "image" | "csv" | "manual";

type FetchResult = {
  text: string;
  contentType: string;
  byteLength: number;
  detectedType: SourceType;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_SOURCE_TYPES = new Set<SourceType>([
  "website",
  "pdf",
  "image",
  "csv",
  "manual",
]);

const MAX_RAW_TEXT_LENGTH = 100_000;
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
]);

const USEFUL_KEYWORDS = [
  "fajr",
  "dhuhr",
  "zuhr",
  "asr",
  "maghrib",
  "isha",
  "jummah",
  "jumu",
  "prayer",
  "salah",
  "salaah",
  "timetable",
  "iqamah",
  "jama",
  "adhan",
  "sunrise",
];

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
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
  const contentType = request.headers.get("content-type");

  return Boolean(
    contentType?.toLowerCase().includes("application/json")
  );
}

function cleanSourceType(value: unknown): SourceType {
  const cleaned = cleanString(value)?.toLowerCase();

  if (
    cleaned &&
    ALLOWED_SOURCE_TYPES.has(cleaned as SourceType)
  ) {
    return cleaned as SourceType;
  }

  return "website";
}

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  );

  if (!match) {
    return false;
  }

  const octets = match.slice(1).map(Number);

  if (
    octets.some(
      (octet) =>
        !Number.isInteger(octet) ||
        octet < 0 ||
        octet > 255
    )
  ) {
    return true;
  }

  const [first, second] = octets;

  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function validatePublicUrl(value: string): URL | null {
  try {
    const url = new URL(value);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    const hostname = url.hostname.toLowerCase();

    if (
      !hostname ||
      BLOCKED_HOSTNAMES.has(hostname) ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      isPrivateIpv4(hostname)
    ) {
      return null;
    }

    url.hash = "";

    return url;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const parsed = Number(code);

      return Number.isInteger(parsed)
        ? String.fromCodePoint(parsed)
        : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const parsed = Number.parseInt(code, 16);

      return Number.isInteger(parsed)
        ? String.fromCodePoint(parsed)
        : "";
    })
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u0022/gi, '"')
    .replace(/\\u0027/gi, "'");
}

function compactText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtmlButKeepText(html: string): string {
  return compactText(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|section|article|header|footer)>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function extractUsefulScripts(html: string): string {
  const scripts = Array.from(
    html.matchAll(
      /<script\b[^>]*>([\s\S]*?)<\/script>/gi
    )
  )
    .map((match) => compactText(match[1] ?? ""))
    .filter((script) => {
      if (!script) {
        return false;
      }

      const lower = script.toLowerCase();

      return USEFUL_KEYWORDS.some((keyword) =>
        lower.includes(keyword)
      );
    })
    .map((script) => script.slice(0, 20_000));

  return scripts.join(
    "\n\n--- SCRIPT DATA ---\n\n"
  );
}

function extractTablesAsText(html: string): string {
  const tables = Array.from(
    html.matchAll(/<table\b[\s\S]*?<\/table>/gi)
  )
    .map((match) => match[0] ?? "")
    .map((table) =>
      compactText(
        table
          .replace(/<\/tr>/gi, "\n")
          .replace(/<\/t[dh]>/gi, " | ")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, " ")
      )
    )
    .filter(Boolean);

  return tables.join("\n\n--- TABLE ---\n\n");
}

function extractJsonLikeData(html: string): string {
  const blocks: string[] = [];

  const nextData = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );

  if (nextData?.[1]) {
    blocks.push(
      `__NEXT_DATA__:\n${compactText(
        nextData[1]
      ).slice(0, 30_000)}`
    );
  }

  const jsonLdBlocks = Array.from(
    html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  );

  jsonLdBlocks.forEach((match, index) => {
    const block = compactText(match[1] ?? "");

    if (block) {
      blocks.push(
        `JSON_LD_${index + 1}:\n${block.slice(
          0,
          10_000
        )}`
      );
    }
  });

  return blocks.join(
    "\n\n--- JSON DATA ---\n\n"
  );
}

function buildExtractedText(html: string): string {
  const readableText = stripHtmlButKeepText(html);
  const tablesText = extractTablesAsText(html);
  const jsonText = extractJsonLikeData(html);
  const usefulScripts = extractUsefulScripts(html);

  return compactText(
    [
      readableText
        ? `READABLE PAGE TEXT:\n${readableText}`
        : "",
      tablesText
        ? `EXTRACTED TABLES:\n${tablesText}`
        : "",
      jsonText
        ? `EXTRACTED JSON DATA:\n${jsonText}`
        : "",
      usefulScripts
        ? `EXTRACTED SCRIPT DATA:\n${usefulScripts}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n")
  );
}

function limitText(
  value: string,
  maxLength = MAX_RAW_TEXT_LENGTH
): string {
  return value.length <= maxLength
    ? value
    : value.slice(0, maxLength);
}

function detectSourceType(
  requestedType: SourceType,
  contentType: string,
  url: URL
): SourceType {
  const lowerContentType =
    contentType.toLowerCase();
  const pathname = url.pathname.toLowerCase();

  if (
    requestedType === "pdf" ||
    lowerContentType.includes("application/pdf") ||
    pathname.endsWith(".pdf")
  ) {
    return "pdf";
  }

  if (
    requestedType === "image" ||
    lowerContentType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|tiff?)$/.test(pathname)
  ) {
    return "image";
  }

  if (
    requestedType === "csv" ||
    lowerContentType.includes("text/csv") ||
    pathname.endsWith(".csv")
  ) {
    return "csv";
  }

  return requestedType;
}

async function fetchWithSafeRedirects(
  initialUrl: URL,
  signal: AbortSignal
): Promise<Response> {
  let currentUrl = initialUrl;

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    const response = await fetch(currentUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SalahNearMe-TimetableImporter/1.0)",
        Accept:
          "text/html,application/xhtml+xml,application/xml,text/plain,text/csv,application/json,application/pdf,image/*,*/*;q=0.8",
      },
      cache: "no-store",
      redirect: "manual",
      signal,
    });

    if (
      response.status < 300 ||
      response.status >= 400
    ) {
      return response;
    }

    const location = response.headers.get("location");

    if (!location) {
      throw new Error(
        "The source returned an invalid redirect."
      );
    }

    const redirectedUrl = validatePublicUrl(
      new URL(location, currentUrl).toString()
    );

    if (!redirectedUrl) {
      throw new Error(
        "The source redirected to a blocked or invalid URL."
      );
    }

    currentUrl = redirectedUrl;
  }

  throw new Error(
    "The source returned too many redirects."
  );
}

async function readLimitedBody(
  response: Response
): Promise<Uint8Array> {
  const contentLength = Number(
    response.headers.get("content-length")
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_DOWNLOAD_BYTES
  ) {
    throw new Error(
      "The source file is too large to import."
    );
  }

  const buffer = new Uint8Array(
    await response.arrayBuffer()
  );

  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(
      "The source file is too large to import."
    );
  }

  return buffer;
}

async function fetchRawText(
  sourceUrl: string,
  sourceType: SourceType
): Promise<FetchResult> {
  const validatedUrl = validatePublicUrl(sourceUrl);

  if (!validatedUrl) {
    throw new Error(
      "The timetable source URL is invalid or blocked."
    );
  }

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchWithSafeRedirects(
      validatedUrl,
      controller.signal
    );

    if (!response.ok) {
      throw new Error(
        `Source returned HTTP ${response.status}.`
      );
    }

    const contentType =
      response.headers.get("content-type") ?? "";
    const bodyBytes = await readLimitedBody(response);

    const detectedType = detectSourceType(
      sourceType,
      contentType,
      validatedUrl
    );

    if (detectedType === "pdf") {
      return {
        text: [
          "PDF file detected.",
          `Fetched ${bodyBytes.byteLength} bytes from: ${validatedUrl.toString()}`,
          "Automatic PDF text extraction is not currently available. Paste extracted text manually or use the timetable OCR/parser workflow.",
        ].join("\n"),
        contentType,
        byteLength: bodyBytes.byteLength,
        detectedType,
      };
    }

    if (detectedType === "image") {
      return {
        text: [
          "Image file detected.",
          `Fetched ${bodyBytes.byteLength} bytes from: ${validatedUrl.toString()}`,
          "Automatic image OCR is not currently available. Paste OCR text manually before parsing.",
        ].join("\n"),
        contentType,
        byteLength: bodyBytes.byteLength,
        detectedType,
      };
    }

    const raw = new TextDecoder("utf-8", {
      fatal: false,
    }).decode(bodyBytes);

    const lowerContentType =
      contentType.toLowerCase();
    const rawLower = raw.slice(0, 5_000).toLowerCase();

    const extractedText =
      lowerContentType.includes("text/html") ||
      lowerContentType.includes(
        "application/xhtml+xml"
      ) ||
      rawLower.includes("<html") ||
      rawLower.includes("<body")
        ? buildExtractedText(raw)
        : compactText(raw);

    if (!extractedText) {
      throw new Error(
        "The source did not contain readable timetable text."
      );
    }

    return {
      text: limitText(extractedText),
      contentType,
      byteLength: bodyBytes.byteLength,
      detectedType,
    };
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "The timetable source request timed out."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: Request) {
  try {
    if (!isJsonRequest(request)) {
      return jsonResponse(
        {
          ok: false,
          error: "Content-Type must be application/json.",
        },
        415
      );
    }

    const body = (await request
      .json()
      .catch(() => null)) as unknown;

    if (!isPlainObject(body)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid JSON body.",
        },
        400
      );
    }

    const importId = cleanString(body.import_id);

    if (!isUuid(importId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid import_id.",
        },
        400
      );
    }

    const {
      data: importRowRaw,
      error: importError,
    } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .select(
        "id, mosque_id, source_id, source_url, source_type"
      )
      .eq("id", importId)
      .maybeSingle();

    if (importError) {
      console.error(
        "timetable extract import lookup error:",
        importError
      );

      return jsonResponse(
        {
          ok: false,
          error: "Could not load the timetable import.",
        },
        500
      );
    }

    if (!importRowRaw) {
      return jsonResponse(
        {
          ok: false,
          error: "Import record not found.",
        },
        404
      );
    }

    const importRow =
      importRowRaw as TimetableImportRow;

    const mosqueId = cleanString(
      importRow.mosque_id
    );

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The timetable import is not linked to a valid mosque.",
        },
        400
      );
    }

    const permission =
      await requireMosqueManager(mosqueId);

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error: permission.error,
        },
        permission.status
      );
    }

    const sourceUrl = cleanString(
      importRow.source_url
    );
    const sourceType = cleanSourceType(
      importRow.source_type
    );

    if (!sourceUrl) {
      return jsonResponse(
        {
          ok: false,
          error: "Import has no source_url.",
        },
        400
      );
    }

    if (!validatePublicUrl(sourceUrl)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The timetable source URL is invalid or blocked.",
        },
        400
      );
    }

    const startedAt = new Date().toISOString();

    const {
      data: extractingImport,
      error: extractingError,
    } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .update({
        status: "extracting",
        error_message: null,
        updated_at: startedAt,
      })
      .eq("id", importId)
      .eq("mosque_id", mosqueId)
      .select("id")
      .maybeSingle();

    if (extractingError || !extractingImport) {
      console.error(
        "timetable extracting status update error:",
        extractingError
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not start timetable extraction.",
        },
        extractingError ? 500 : 409
      );
    }

    try {
      const fetched = await fetchRawText(
        sourceUrl,
        sourceType
      );

      const rawText = limitText(fetched.text);
      const completedAt = new Date().toISOString();

      const confidenceScore =
        fetched.detectedType === "pdf" ||
        fetched.detectedType === "image"
          ? 10
          : rawText.length >= 1_000
            ? 50
            : rawText.length >= 100
              ? 40
              : 20;

      const {
        data: updatedImport,
        error: updateError,
      } = await supabaseAdmin
        .from("mosque_timetable_imports")
        .update({
          raw_text: rawText,
          extracted_json: null,
          status: "extracted",
          error_message: null,
          confidence_score: confidenceScore,
          updated_at: completedAt,
        })
        .eq("id", importId)
        .eq("mosque_id", mosqueId)
        .select("*")
        .maybeSingle();

      if (updateError || !updatedImport) {
        console.error(
          "timetable extract update error:",
          updateError
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "The source was extracted, but the import record could not be updated.",
          },
          updateError ? 500 : 409
        );
      }

      const sourceId = cleanString(
        importRow.source_id
      );

      if (isUuid(sourceId)) {
        const { error: sourceUpdateError } =
          await supabaseAdmin
            .from("mosque_timetable_sources")
            .update({
              last_checked_at: completedAt,
              last_success_at: completedAt,
              last_error: null,
              updated_at: completedAt,
            })
            .eq("id", sourceId)
            .eq("mosque_id", mosqueId);

        if (sourceUpdateError) {
          console.error(
            "timetable extract source update error:",
            sourceUpdateError
          );
        }
      }

      return jsonResponse({
        ok: true,
        message:
          "Timetable source extracted successfully.",
        raw_text_length: rawText.length,
        downloaded_bytes: fetched.byteLength,
        content_type: fetched.contentType,
        detected_source_type: fetched.detectedType,
        import: updatedImport,
      });
    } catch (extractError) {
      const message =
        extractError instanceof Error
          ? extractError.message.slice(0, 1_000)
          : "Could not extract timetable source.";

      const failedAt = new Date().toISOString();

      const { error: failureUpdateError } =
        await supabaseAdmin
          .from("mosque_timetable_imports")
          .update({
            status: "failed",
            error_message: message,
            updated_at: failedAt,
          })
          .eq("id", importId)
          .eq("mosque_id", mosqueId);

      if (failureUpdateError) {
        console.error(
          "timetable extraction failure status error:",
          failureUpdateError
        );
      }

      const sourceId = cleanString(
        importRow.source_id
      );

      if (isUuid(sourceId)) {
        const { error: sourceFailureError } =
          await supabaseAdmin
            .from("mosque_timetable_sources")
            .update({
              last_checked_at: failedAt,
              last_error: message,
              updated_at: failedAt,
            })
            .eq("id", sourceId)
            .eq("mosque_id", mosqueId);

        if (sourceFailureError) {
          console.error(
            "timetable source failure update error:",
            sourceFailureError
          );
        }
      }

      return jsonResponse(
        {
          ok: false,
          error: message,
        },
        502
      );
    }
  } catch (error) {
    console.error(
      "timetable extract route error:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error: "Could not extract timetable import.",
      },
      500
    );
  }
}
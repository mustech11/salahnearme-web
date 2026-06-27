import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  import_id?: string;
};

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function isUuid(value: string | null) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\u0026/g, "&")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u0022/g, '"')
    .replace(/\\u0027/g, "'");
}

function compactText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtmlButKeepText(html: string) {
  return compactText(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function extractUsefulScripts(html: string) {
  const scripts = Array.from(
    html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)
  ).map((match) => match[1] ?? "");

  const usefulKeywords = [
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

  const useful = scripts
    .map((script) => compactText(script))
    .filter((script) => {
      const lower = script.toLowerCase();

      return usefulKeywords.some((keyword) => lower.includes(keyword));
    })
    .map((script) => script.slice(0, 20000));

  return useful.join("\n\n--- SCRIPT DATA ---\n\n");
}

function extractTablesAsText(html: string) {
  const tables = Array.from(html.matchAll(/<table[\s\S]*?<\/table>/gi)).map(
    (match) => match[0] ?? ""
  );

  return tables
    .map((table) =>
      compactText(
        table
          .replace(/<\/tr>/gi, "\n")
          .replace(/<\/td>/gi, " | ")
          .replace(/<\/th>/gi, " | ")
          .replace(/<[^>]+>/g, " ")
      )
    )
    .filter(Boolean)
    .join("\n\n--- TABLE ---\n\n");
}

function extractJsonLikeData(html: string) {
  const nextData = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );

  const blocks: string[] = [];

  if (nextData?.[1]) {
    blocks.push(`__NEXT_DATA__:\n${compactText(nextData[1]).slice(0, 30000)}`);
  }

  const jsonLdBlocks = Array.from(
    html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ).map((match) => match[1] ?? "");

  jsonLdBlocks.forEach((block, index) => {
    blocks.push(`JSON_LD_${index + 1}:\n${compactText(block).slice(0, 10000)}`);
  });

  return blocks.join("\n\n--- JSON DATA ---\n\n");
}

function buildExtractedText(html: string) {
  const readableText = stripHtmlButKeepText(html);
  const tablesText = extractTablesAsText(html);
  const jsonText = extractJsonLikeData(html);
  const usefulScripts = extractUsefulScripts(html);

  return compactText(
    [
      "READABLE PAGE TEXT:",
      readableText,
      tablesText ? "\n\nEXTRACTED TABLES:\n" + tablesText : "",
      jsonText ? "\n\nEXTRACTED JSON DATA:\n" + jsonText : "",
      usefulScripts ? "\n\nEXTRACTED SCRIPT DATA:\n" + usefulScripts : "",
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function limitText(value: string, maxLength = 120000) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength);
}

async function fetchRawText(sourceUrl: string, sourceType: string | null) {
  const res = await fetch(sourceUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 SalahNearMe timetable importer/1.0",
      Accept:
        "text/html,application/xhtml+xml,application/xml,text/plain,application/json,application/pdf,*/*",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Source returned HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const lowerContentType = contentType.toLowerCase();

  if (sourceType === "pdf" || lowerContentType.includes("application/pdf")) {
    const arrayBuffer = await res.arrayBuffer();

    return [
      "PDF file detected.",
      `Fetched ${arrayBuffer.byteLength} bytes from: ${sourceUrl}`,
      "PDF text extraction needs the PDF parser phase.",
    ].join("\n");
  }

  if (sourceType === "image" || lowerContentType.startsWith("image/")) {
    const arrayBuffer = await res.arrayBuffer();

    return [
      "Image file detected.",
      `Fetched ${arrayBuffer.byteLength} bytes from: ${sourceUrl}`,
      "Image/OCR extraction needs the OCR parser phase.",
    ].join("\n");
  }

  const raw = await res.text();

  if (
    lowerContentType.includes("text/html") ||
    raw.toLowerCase().includes("<html") ||
    raw.toLowerCase().includes("<body")
  ) {
    return buildExtractedText(raw);
  }

  return compactText(raw);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid JSON body.",
        },
        {
          status: 400,
        }
      );
    }

    const importId = cleanString(body.import_id);

    if (!isUuid(importId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing or invalid import_id.",
        },
        {
          status: 400,
        }
      );
    }

    const { data: importRow, error: importError } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .select("*")
      .eq("id", importId)
      .maybeSingle();

    if (importError) {
      return NextResponse.json(
        {
          ok: false,
          error: importError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!importRow) {
      return NextResponse.json(
        {
          ok: false,
          error: "Import record not found.",
        },
        {
          status: 404,
        }
      );
    }

    const mosqueId = cleanString(importRow.mosque_id);

    const permission = await requireMosqueManager(mosqueId);

    if (!permission.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: permission.error,
        },
        {
          status: permission.status,
        }
      );
    }

    const sourceUrl = cleanString(importRow.source_url);
    const sourceType = cleanString(importRow.source_type);

    if (!sourceUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "Import has no source_url.",
        },
        {
          status: 400,
        }
      );
    }

    const now = new Date().toISOString();

    await supabaseAdmin
      .from("mosque_timetable_imports")
      .update({
        status: "extracting",
        error_message: null,
        updated_at: now,
      })
      .eq("id", importId);

    try {
      const rawText = limitText(await fetchRawText(sourceUrl, sourceType));
      const nextNow = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("mosque_timetable_imports")
        .update({
          raw_text: rawText,
          status: "extracted",
          error_message: null,
          confidence_score: rawText.length > 1000 ? 50 : 40,
          updated_at: nextNow,
        })
        .eq("id", importId)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
          },
          {
            status: 500,
          }
        );
      }

      if (importRow.source_id) {
        await supabaseAdmin
          .from("mosque_timetable_sources")
          .update({
            last_checked_at: nextNow,
            last_success_at: nextNow,
            last_error: null,
            updated_at: nextNow,
          })
          .eq("id", importRow.source_id)
          .eq("mosque_id", mosqueId);
      }

      return NextResponse.json(
        {
          ok: true,
          raw_text_length: rawText.length,
          import: data,
        },
        {
          status: 200,
        }
      );
    } catch (extractError) {
      const message =
        extractError instanceof Error
          ? extractError.message
          : "Could not extract timetable source.";

      const failedNow = new Date().toISOString();

      await supabaseAdmin
        .from("mosque_timetable_imports")
        .update({
          status: "failed",
          error_message: message,
          updated_at: failedNow,
        })
        .eq("id", importId);

      if (importRow.source_id) {
        await supabaseAdmin
          .from("mosque_timetable_sources")
          .update({
            last_checked_at: failedNow,
            last_error: message,
            updated_at: failedNow,
          })
          .eq("id", importRow.source_id)
          .eq("mosque_id", mosqueId);
      }

      return NextResponse.json(
        {
          ok: false,
          error: message,
        },
        {
          status: 500,
        }
      );
    }
  } catch (error) {
    console.error("timetable extract route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not extract timetable import.",
      },
      {
        status: 500,
      }
    );
  }
}


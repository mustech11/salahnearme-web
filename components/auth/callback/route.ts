import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_REDIRECT = "/dashboard/business";

function cleanString(
  value: string | null | undefined,
  maxLength = 2_000
): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function getSafeRedirectPath(
  value: string | null
): string {
  const candidate = cleanString(value);

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return DEFAULT_REDIRECT;
  }

  try {
    const parsed = new URL(
      candidate,
      "https://salahnearme.local"
    );

    if (
      parsed.origin !==
      "https://salahnearme.local"
    ) {
      return DEFAULT_REDIRECT;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_REDIRECT;
  }
}

function buildLoginErrorUrl(
  origin: string,
  message: string
): URL {
  const loginUrl = new URL(
    "/login",
    origin
  );

  loginUrl.searchParams.set(
    "error",
    cleanString(
      message,
      500
    ) ||
      "Authentication could not be completed."
  );

  return loginUrl;
}

export async function GET(
  request: Request
) {
  const requestUrl = new URL(
    request.url
  );

  const code = cleanString(
    requestUrl.searchParams.get("code"),
    2_000
  );

  const error = cleanString(
    requestUrl.searchParams.get("error"),
    300
  );

  const errorDescription = cleanString(
    requestUrl.searchParams.get(
      "error_description"
    ),
    500
  );

  const nextPath =
    getSafeRedirectPath(
      requestUrl.searchParams.get("next")
    );

  if (error || errorDescription) {
    return NextResponse.redirect(
      buildLoginErrorUrl(
        requestUrl.origin,
        errorDescription ||
          error
      ),
      {
        status: 303,
      }
    );
  }

  if (!code) {
    return NextResponse.redirect(
      buildLoginErrorUrl(
        requestUrl.origin,
        "The authentication callback did not include a valid code."
      ),
      {
        status: 303,
      }
    );
  }

  try {
    const supabase =
      await supabaseServer();

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(
        code
      );

    if (exchangeError) {
      console.error(
        "Auth callback session exchange failed:",
        {
          name:
            exchangeError.name,
          status:
            exchangeError.status,
          message:
            exchangeError.message,
        }
      );

      return NextResponse.redirect(
        buildLoginErrorUrl(
          requestUrl.origin,
          exchangeError.message
        ),
        {
          status: 303,
        }
      );
    }

    return NextResponse.redirect(
      new URL(
        nextPath,
        requestUrl.origin
      ),
      {
        status: 303,
      }
    );
  } catch (callbackError) {
    console.error(
      "Auth callback failed:",
      callbackError
    );

    return NextResponse.redirect(
      buildLoginErrorUrl(
        requestUrl.origin,
        "Authentication could not be completed. Please try again."
      ),
      {
        status: 303,
      }
    );
  }
}
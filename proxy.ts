import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/admin", "/business-dashboard"];

const AUTH_PAGES = ["/login", "/sign-in", "/signin"];

const DEFAULT_SIGNED_IN_REDIRECT = "/business-dashboard";

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAuthPage(pathname: string) {
  return AUTH_PAGES.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function buildCurrentPath(request: NextRequest) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

function buildLoginRedirectUrl(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();

  redirectUrl.pathname = "/login";
  redirectUrl.search = "";

  const currentPath = buildCurrentPath(request);

  if (currentPath && currentPath !== "/login") {
    redirectUrl.searchParams.set("redirectTo", currentPath);
    redirectUrl.searchParams.set("next", currentPath);
  }

  return redirectUrl;
}

function getSafeRedirectPath(value: string | null) {
  if (!value) {
    return DEFAULT_SIGNED_IN_REDIRECT;
  }

  if (!value.startsWith("/")) {
    return DEFAULT_SIGNED_IN_REDIRECT;
  }

  if (value.startsWith("//")) {
    return DEFAULT_SIGNED_IN_REDIRECT;
  }

  if (value.startsWith("/login") || value.startsWith("/sign-in")) {
    return DEFAULT_SIGNED_IN_REDIRECT;
  }

  return value;
}

function buildSignedInRedirectUrl(request: NextRequest) {
  const redirectTo =
    request.nextUrl.searchParams.get("redirectTo") ??
    request.nextUrl.searchParams.get("next");

  const safeRedirectTo = getSafeRedirectPath(redirectTo);

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = safeRedirectTo;
  redirectUrl.search = "";

  return redirectUrl;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (isProtectedPath(pathname) && !user) {
    return NextResponse.redirect(buildLoginRedirectUrl(request));
  }

  if (isAuthPage(pathname) && user) {
    return NextResponse.redirect(buildSignedInRedirectUrl(request));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - Next static files
     * - Next image files
     * - favicon
     * - common public/static file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json)$).*)",
  ],
};

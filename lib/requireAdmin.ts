import { createClient } from "@supabase/supabase-js";

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function requireAdmin(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";

    const token = auth.startsWith("Bearer ")
      ? auth.slice(7)
      : null;

    if (!token) {
      return {
        ok: false as const,
        status: 401,
        error: "Missing auth token",
      };
    }

    const {
      data: userRes,
      error: userErr,
    } = await supabaseAnon.auth.getUser(token);

    if (userErr || !userRes?.user) {
      return {
        ok: false as const,
        status: 401,
        error: "Invalid session",
      };
    }

    const userId = userRes.user.id;

    const { data: profile, error: profileErr } =
      await supabaseService
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

    if (profileErr) {
      return {
        ok: false as const,
        status: 500,
        error: profileErr.message,
      };
    }

    if (profile?.role !== "admin") {
      return {
        ok: false as const,
        status: 403,
        error: "Not admin",
      };
    }

    return {
      ok: true as const,
      userId,
      supabaseService,
    };
  } catch (error) {
    return {
      ok: false as const,
      status: 500,
      error:
        error instanceof Error
          ? error.message
          : "Unknown admin error",
    };
  }
}


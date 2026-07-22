import "server-only";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import {
  getServerEnv,
  publicEnv,
} from "@/lib/env";

function createSupabaseAdminClient(): SupabaseClient {
  const serverEnv = getServerEnv();

  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },

      global: {
        headers: {
          "X-Client-Info":
            "salahnearme-server-admin",
        },
      },
    }
  );
}

declare global {
  var __salahNearMeSupabaseAdmin:
    | SupabaseClient
    | undefined;
}

export const supabaseAdmin =
  globalThis.__salahNearMeSupabaseAdmin ??
  createSupabaseAdminClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__salahNearMeSupabaseAdmin =
    supabaseAdmin;
}
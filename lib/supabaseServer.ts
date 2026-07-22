import "server-only";

import { createServerClient } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";

const GLOBAL_PUBLIC_CLIENT_KEY = "__salahNearMeSupabasePublic";

type SupabaseGlobal = typeof globalThis & {
  [GLOBAL_PUBLIC_CLIENT_KEY]?: SupabaseClient;
};

function getPublicSupabaseConfiguration() {
  return {
    url: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export async function supabaseServer() {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseConfiguration();

  return createServerClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },

    cookies: {
      getAll() {
        return cookieStore.getAll();
      },

      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /*
           * Server Components cannot always write response cookies.
           * Session refresh should be handled by proxy.ts.
           */
        }
      },
    },

    global: {
      headers: {
        "X-Client-Info": "salahnearme-server-auth",
      },
    },
  });
}

export function supabasePublic(): SupabaseClient {
  const globalStore = globalThis as SupabaseGlobal;

  if (globalStore[GLOBAL_PUBLIC_CLIENT_KEY]) {
    return globalStore[GLOBAL_PUBLIC_CLIENT_KEY];
  }

  const { url, anonKey } = getPublicSupabaseConfiguration();

  const client = createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },

    db: {
      schema: "public",
    },

    global: {
      headers: {
        "X-Client-Info": "salahnearme-server-public",
      },
    },
  });

  globalStore[GLOBAL_PUBLIC_CLIENT_KEY] = client;

  return client;
}

/*
 * Compatibility export for older server-side files that import:
 *
 * import { createClient } from "@/lib/supabaseServer";
 *
 * New files should normally use:
 * - supabaseServer()
 * - supabasePublic()
 * - supabaseAdmin from "@/lib/supabaseAdmin"
 */
export { createSupabaseClient as createClient };
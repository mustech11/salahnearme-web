import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";

const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },

      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /*
            Server Components cannot always set cookies.
            This is safe to ignore when proxy.ts refreshes sessions.
          */
        }
      },
    },
  });
}

export function supabasePublic() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/*
  Compatibility export for older routes that still import:
  import { createClient } from "@/lib/supabaseServer";

  New code should normally use supabaseServer(), supabasePublic(),
  or supabaseAdmin from "@/lib/supabaseAdmin".
*/
export { createClient };
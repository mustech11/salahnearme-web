import { createClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "@/lib/env";

export const supabaseAdmin = createClient(
  publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);


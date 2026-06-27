"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
    >
      Log out
    </button>
  );
}


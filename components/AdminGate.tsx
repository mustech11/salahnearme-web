"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * Phase 9.3 AdminGate
 * -------------------
 * This component is now intentionally a pass-through wrapper.
 *
 * Why?
 * - Admin security is now handled server-side by app/admin/layout.tsx
 * - The server layout uses requireAdmin()
 * - requireAdmin() checks the signed-in Supabase user against public.admin_users
 * - This avoids the old client-side “Checking access...” problem
 *
 * Important:
 * Do not add password checks, sessionStorage checks, or client-side access checks here.
 * Client-side gates are not strong security. Server-side role checks are.
 */
export default function AdminGate({ children }: Props) {
  return <>{children}</>;
}


import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type MosqueManagerRole = "owner" | "manager" | "editor";

export async function getMosqueRoleForEmail(
  mosqueId: string,
  email: string
): Promise<MosqueManagerRole | null> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("mosque_manager_roles")
    .select("role,status")
    .eq("mosque_id", mosqueId)
    .eq("user_email", normalizedEmail)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const role = data.role;
  if (role === "owner" || role === "manager" || role === "editor") {
    return role;
  }

  return null;
}

export async function canManageMosque(
  mosqueId: string,
  email: string
): Promise<boolean> {
  const role = await getMosqueRoleForEmail(mosqueId, email);
  return role !== null;
}

export async function canAdministrativelyManageMosque(
  mosqueId: string,
  email: string
): Promise<boolean> {
  const role = await getMosqueRoleForEmail(mosqueId, email);
  return role === "owner" || role === "manager";
}


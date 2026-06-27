import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AdminRole = "owner" | "admin" | "moderator";

type AdminPermissionOk = {
  ok: true;
  userId: string;
  email: string | null;
  role: AdminRole;
};

type AdminPermissionFail = {
  ok: false;
  error: string;
  status: 401 | 403 | 500;
};

export type AdminPermission = AdminPermissionOk | AdminPermissionFail;

const ALLOWED_ADMIN_ROLES: AdminRole[] = ["owner", "admin", "moderator"];

export async function requireAdmin(): Promise<AdminPermission> {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return {
        ok: false,
        error: userError.message,
        status: 500,
      };
    }

    if (!user) {
      return {
        ok: false,
        error: "You must be signed in to access the admin area.",
        status: 401,
      };
    }

    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select("user_id, email, role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (adminError) {
      return {
        ok: false,
        error: adminError.message,
        status: 500,
      };
    }

    if (!adminUser) {
      return {
        ok: false,
        error: "You do not have admin access.",
        status: 403,
      };
    }

    const role = adminUser.role as AdminRole;

    if (!ALLOWED_ADMIN_ROLES.includes(role)) {
      return {
        ok: false,
        error: "Your admin role is not recognised.",
        status: 403,
      };
    }

    return {
      ok: true,
      userId: user.id,
      email: adminUser.email ?? user.email ?? null,
      role,
    };
  } catch (error) {
    console.error("requireAdmin error:", error);

    return {
      ok: false,
      error: "Could not verify admin access.",
      status: 500,
    };
  }
}

export async function requireOwnerOrAdmin(): Promise<AdminPermission> {
  const permission = await requireAdmin();

  if (!permission.ok) {
    return permission;
  }

  if (permission.role !== "owner" && permission.role !== "admin") {
    return {
      ok: false,
      error: "Only owners and admins can access this area.",
      status: 403,
    };
  }

  return permission;
}


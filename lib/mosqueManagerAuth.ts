import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

const APPROVED_CLAIM_STATUSES = ["approved", "active", "verified"] as const;

const BLOCKED_MANAGER_ROLES = ["viewer", "read_only", "blocked"] as const;

type ApprovedClaimStatus = (typeof APPROVED_CLAIM_STATUSES)[number];

type BlockedManagerRole = (typeof BLOCKED_MANAGER_ROLES)[number];

type MosqueManagerClaim = {
  id: string;
  mosque_id: string;
  user_id: string;
  status: string | null;
  role: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MosqueSummary = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  area: string | null;
  postcode: string | null;
  verified_status: string | null;
};

type PermissionSuccess = {
  ok: true;
  status: 200;
  userId: string;
  userEmail: string | null;
  mosqueId: string;
  mosque: MosqueSummary | null;
  claim: {
    id: string;
    mosque_id: string;
    user_id: string;
    status: string | null;
    role: string | null;
  };
};

type PermissionFailure = {
  ok: false;
  status: 400 | 401 | 403 | 404 | 500;
  error: string;
};

export type MosqueManagerPermission = PermissionSuccess | PermissionFailure;

function isUuid(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function normaliseRole(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function isApprovedClaimStatus(
  value: string | null | undefined
): value is ApprovedClaimStatus {
  return APPROVED_CLAIM_STATUSES.includes(value as ApprovedClaimStatus);
}

function isBlockedManagerRole(
  value: string | null | undefined
): value is BlockedManagerRole {
  return BLOCKED_MANAGER_ROLES.includes(
    normaliseRole(value) as BlockedManagerRole
  );
}

function getPermissionError(status: PermissionFailure["status"], error: string) {
  return {
    ok: false,
    status,
    error,
  } satisfies PermissionFailure;
}

export async function getSignedInUser() {
  const supabase = await supabaseServer();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return {
    user,
    error,
  };
}

export async function requireMosqueManager(
  mosqueId: string | null | undefined
): Promise<MosqueManagerPermission> {
  try {
    if (!isUuid(mosqueId)) {
      return getPermissionError(400, "Missing or invalid mosque_id.");
    }

    const { user, error: userError } = await getSignedInUser();

    if (userError) {
      return getPermissionError(500, userError.message);
    }

    if (!user) {
      return getPermissionError(401, "You must be signed in.");
    }

    const { data: mosqueRaw, error: mosqueError } = await supabaseAdmin
      .from("mosques")
      .select("id, name, slug, city, area, postcode, verified_status")
      .eq("id", mosqueId)
      .maybeSingle();

    if (mosqueError) {
      return getPermissionError(500, mosqueError.message);
    }

    if (!mosqueRaw) {
      return getPermissionError(404, "Mosque not found.");
    }

    const mosque = mosqueRaw as MosqueSummary;

    const { data: claimRaw, error: claimError } = await supabaseAdmin
      .from("mosque_claims")
      .select("id, mosque_id, user_id, status, role, created_at, updated_at")
      .eq("mosque_id", mosqueId)
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (claimError) {
      return getPermissionError(500, claimError.message);
    }

    if (!claimRaw) {
      return getPermissionError(
        403,
        "You do not have permission to manage this mosque."
      );
    }

    const claim = claimRaw as MosqueManagerClaim;

    if (!isApprovedClaimStatus(claim.status)) {
      return getPermissionError(
        403,
        "Your mosque claim is not approved yet."
      );
    }

    if (isBlockedManagerRole(claim.role)) {
      return getPermissionError(
        403,
        "Your mosque manager role does not allow editing."
      );
    }

    return {
      ok: true,
      status: 200,
      userId: user.id,
      userEmail: user.email ?? null,
      mosqueId,
      mosque,
      claim: {
        id: claim.id,
        mosque_id: claim.mosque_id,
        user_id: claim.user_id,
        status: claim.status,
        role: claim.role,
      },
    };
  } catch (error) {
    console.error("requireMosqueManager error:", error);

    return getPermissionError(
      500,
      "Could not verify mosque manager permission."
    );
  }
}

export async function requireMosqueManagerForApi(
  mosqueId: string | null | undefined
) {
  const permission = await requireMosqueManager(mosqueId);

  if (!permission.ok) {
    return {
      permission,
      response: Response.json(
        {
          ok: false,
          error: permission.error,
        },
        {
          status: permission.status,
        }
      ),
    };
  }

  return {
    permission,
    response: null,
  };
}

export function canManageMosque(permission: MosqueManagerPermission) {
  return permission.ok;
}

export function getMosqueManagerRole(permission: MosqueManagerPermission) {
  if (!permission.ok) {
    return null;
  }

  return permission.claim.role;
}


import { requireAdmin } from "@/lib/requireAdmin";

/**
 * Supports either of these existing project signatures:
 *
 *   await requireAdmin()
 *   await requireAdmin(request)
 *
 * JavaScript safely ignores an extra function argument, while the cast removes
 * TypeScript red lines without changing your existing admin-auth helper.
 */
export async function requireAdminForRequest(
  request: Request
): Promise<unknown> {
  const guard = requireAdmin as unknown as (
    request?: Request
  ) => Promise<unknown>;

  return guard(request);
}

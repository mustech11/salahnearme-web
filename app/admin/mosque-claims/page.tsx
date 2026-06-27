import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const revalidate = 0;

async function approveClaim(formData: FormData) {
  "use server";

  const claimId = String(formData.get("claim_id") ?? "").trim();
  const grantedRole = String(formData.get("granted_role") ?? "manager").trim();

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/admin/mosque-claims/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      claim_id: claimId,
      granted_role: grantedRole,
    }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? "Could not approve mosque claim");
  }

  revalidatePath("/admin/mosque-claims");
}

async function rejectClaim(formData: FormData) {
  "use server";

  const claimId = String(formData.get("claim_id") ?? "").trim();

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/admin/mosque-claims/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      claim_id: claimId,
    }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? "Could not reject mosque claim");
  }

  revalidatePath("/admin/mosque-claims");
}

export default async function AdminMosqueClaimsPage() {
  const { data, error } = await supabaseAdmin
    .from("mosque_claim_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return <pre className="text-white/80">{error.message}</pre>;
  }

  const claims = data ?? [];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Admin
        </div>
        <h1 className="mt-3 text-4xl font-bold text-white">
          Mosque claim approvals
        </h1>
        <p className="mt-3 text-white/70">
          Review mosque manager access requests and assign official roles.
        </p>

        <div className="mt-6">
          <Link
            href="/admin"
            className="text-sm font-medium text-yellow-400 hover:text-yellow-300"
          >
            ← Back to admin
          </Link>
        </div>
      </section>

      {claims.length === 0 ? (
        <section className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-8 text-white/60">
          No mosque claim requests found yet.
        </section>
      ) : (
        <div className="space-y-6">
          {claims.map((claim) => (
            <section
              key={claim.id}
              className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-2xl font-semibold text-white">
                    {claim.mosque_name ?? "Mosque claim"}
                  </div>
                  <div className="mt-2 text-sm text-white/60">
                    Claimant: {claim.full_name} • {claim.email}
                  </div>
                </div>

                <div className="text-sm text-white/50">
                  {new Date(claim.created_at).toLocaleString()}
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-white/80">
                  <div><span className="text-white/50">Status:</span> {claim.status}</div>
                  <div><span className="text-white/50">Phone:</span> {claim.phone ?? "—"}</div>
                  <div><span className="text-white/50">Role:</span> {claim.role ?? "—"}</div>
                  <div className="pt-2">
                    <div className="text-white/50">Relationship:</div>
                    <div className="mt-1">{claim.relationship ?? "—"}</div>
                  </div>
                  <div className="pt-2">
                    <div className="text-white/50">Proof:</div>
                    <div className="mt-1">{claim.proof ?? "—"}</div>
                  </div>
                </div>

                {claim.status === "pending" ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <form action={approveClaim} className="space-y-4">
                      <input type="hidden" name="claim_id" value={claim.id} />

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/80">
                          Grant role
                        </label>
                        <select
                          name="granted_role"
                          defaultValue="manager"
                          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
                        >
                          <option value="owner">Owner</option>
                          <option value="manager">Manager</option>
                          <option value="editor">Editor</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                      >
                        Approve claim
                      </button>
                    </form>

                    <form action={rejectClaim} className="mt-4">
                      <input type="hidden" name="claim_id" value={claim.id} />
                      <button
                        type="submit"
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                      >
                        Reject claim
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-white/60">
                    This claim has already been reviewed.
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}


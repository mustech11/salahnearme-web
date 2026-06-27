import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import AdminGate from "@/components/AdminGate";
import {
  buildBusinessClaimRecommendation,
  type BusinessClaimRow,
  type BusinessForClaimReview,
} from "@/lib/businessClaimIntelligence";

export const metadata: Metadata = {
  title: "Admin Business Claims | SalahNearMe",
  description:
    "Review and approve business ownership claims with intelligent recommendations.",
};

export const revalidate = 0;

async function approveClaim(formData: FormData) {
  "use server";

  const claimId = String(formData.get("claim_id") ?? "").trim();

  if (!claimId) {
    throw new Error("Missing claim ID");
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/admin/business-claims/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ claim_id: claimId }),
    cache: "no-store",
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Could not approve claim");
  }

  revalidatePath("/admin/business-claims");
  revalidatePath("/admin/businesses");
}

async function rejectClaim(formData: FormData) {
  "use server";

  const claimId = String(formData.get("claim_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!claimId) {
    throw new Error("Missing claim ID");
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/admin/business-claims/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      claim_id: claimId,
      reason: reason || null,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Could not reject claim");
  }

  revalidatePath("/admin/business-claims");
}

function recommendationClass(value: "approve" | "review" | "reject") {
  if (value === "approve") {
    return "border border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (value === "reject") {
    return "border border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
}

function riskClass(value: number) {
  if (value >= 70) {
    return "border border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (value >= 35) {
    return "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  }

  return "border border-green-500/30 bg-green-500/10 text-green-300";
}

function statusClass(status: string | null | undefined) {
  if (status === "approved") {
    return "border border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (status === "rejected") {
    return "border border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
}

export default async function AdminBusinessClaimsPage() {
  const supabase = await supabaseServer();

  const [
    { data: claimsRaw, error: claimsError },
    { data: businessesRaw, error: businessesError },
  ] = await Promise.all([
    supabase
      .from("business_claim_requests")
      .select("*")
      .order("created_at", { ascending: false }),

    supabase
      .from("businesses")
      .select(
        "id,name,slug,email,website,phone,city,is_claimed,claimed_by_email,is_verified,submitted_by_email"
      )
      .order("name", { ascending: true }),
  ]);

  if (claimsError) {
    return <pre className="text-white/80">{claimsError.message}</pre>;
  }

  if (businessesError) {
    return <pre className="text-white/80">{businessesError.message}</pre>;
  }

  const claims = (claimsRaw ?? []) as BusinessClaimRow[];
  const businesses = (businessesRaw ?? []) as BusinessForClaimReview[];

  const businessMap = new Map(businesses.map((b) => [b.id, b]));

  const pendingCount = claims.filter((c) => c.status === "pending").length;
  const approvedCount = claims.filter((c) => c.status === "approved").length;
  const rejectedCount = claims.filter((c) => c.status === "rejected").length;

  return (
    <AdminGate>
      <div className="space-y-8">
        <section className="luxe-card rounded-3xl p-8 md:p-10">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Admin
          </div>

          <h1 className="dashboard-hero-glow mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">
            Business claim approvals
          </h1>

          <p className="mt-4 max-w-3xl text-white/70">
            Review ownership claims with intelligent recommendations based on
            email matching, domain trust, business submission history, proof
            quality, and risk signals.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/admin" className="luxe-button-outline text-sm">
              ← Back to admin
            </Link>

            <Link href="/admin/businesses" className="luxe-button text-sm">
              Manage businesses
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Stat title="Pending" value={pendingCount} />
          <Stat title="Approved" value={approvedCount} />
          <Stat title="Rejected" value={rejectedCount} />
        </section>

        {claims.length === 0 ? (
          <section className="luxe-card-soft rounded-3xl p-8 text-white/60">
            No business claim requests found yet.
          </section>
        ) : (
          <div className="space-y-6">
            {claims.map((claim) => {
              const business = businessMap.get(claim.business_id) ?? null;

              const recommendation = buildBusinessClaimRecommendation({
                claim,
                business,
              });

              return (
                <section key={claim.id} className="luxe-card rounded-3xl p-8">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-2xl font-bold text-white">
                          {claim.business_name ??
                            business?.name ??
                            "Business claim"}
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                            claim.status
                          )}`}
                        >
                          {claim.status ?? "pending"}
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-white/60">
                        Claimant: {claim.full_name} • {claim.email}
                      </div>
                    </div>

                    <div className="text-sm text-white/50">
                      {claim.created_at
                        ? new Date(claim.created_at).toLocaleString()
                        : "No date"}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-3">
                    <div className="luxe-card-soft rounded-2xl p-5">
                      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                        Recommendation
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${recommendationClass(
                            recommendation.recommendation
                          )}`}
                        >
                          {recommendation.recommendation}
                        </span>

                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                          Trust score: {recommendation.score}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${riskClass(
                            recommendation.riskScore
                          )}`}
                        >
                          Risk: {recommendation.riskScore}
                        </span>
                      </div>

                      <div className="mt-5">
                        <div className="text-xs uppercase tracking-[0.2em] text-green-300">
                          Positive signals
                        </div>

                        <div className="mt-3 space-y-2 text-sm text-white/75">
                          {recommendation.reasons.map((reason) => (
                            <div key={reason}>• {reason}</div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="text-xs uppercase tracking-[0.2em] text-red-300">
                          Risk signals
                        </div>

                        <div className="mt-3 space-y-2 text-sm text-white/75">
                          {recommendation.risks.map((risk) => (
                            <div key={risk}>• {risk}</div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="luxe-card-soft rounded-2xl p-5">
                      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                        Claim details
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-white/80">
                        {claim.phone && (
                          <div>
                            <span className="text-white/50">Phone:</span>{" "}
                            {claim.phone}
                          </div>
                        )}

                        {claim.role && (
                          <div>
                            <span className="text-white/50">Role:</span>{" "}
                            {claim.role}
                          </div>
                        )}

                        {claim.relationship && (
                          <div>
                            <div className="text-white/50">Relationship:</div>
                            <div className="mt-1">{claim.relationship}</div>
                          </div>
                        )}

                        {claim.proof && (
                          <div>
                            <div className="text-white/50">Proof:</div>
                            <div className="mt-1 whitespace-pre-wrap">
                              {claim.proof}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="luxe-card-soft rounded-2xl p-5">
                      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                        Business record
                      </div>

                      {business ? (
                        <div className="mt-4 space-y-2 text-sm text-white/80">
                          <div>
                            <span className="text-white/50">Business:</span>{" "}
                            {business.name}
                          </div>

                          <div>
                            <span className="text-white/50">City:</span>{" "}
                            {business.city ?? "—"}
                          </div>

                          <div>
                            <span className="text-white/50">Listed email:</span>{" "}
                            {business.email ?? "—"}
                          </div>

                          <div>
                            <span className="text-white/50">Website:</span>{" "}
                            {business.website ?? "—"}
                          </div>

                          <div>
                            <span className="text-white/50">Phone:</span>{" "}
                            {business.phone ?? "—"}
                          </div>

                          <div>
                            <span className="text-white/50">Claimed:</span>{" "}
                            {business.is_claimed ? "Yes" : "No"}
                          </div>

                          <div>
                            <span className="text-white/50">Verified:</span>{" "}
                            {business.is_verified ? "Yes" : "No"}
                          </div>

                          <div>
                            <span className="text-white/50">
                              Submitted by:
                            </span>{" "}
                            {business.submitted_by_email ?? "—"}
                          </div>

                          {business.slug && (
                            <Link
                              href={`/business/${business.slug}`}
                              target="_blank"
                              className="mt-3 inline-flex text-sm font-semibold text-yellow-400 hover:text-yellow-300"
                            >
                              View business →
                            </Link>
                          )}
                        </div>
                      ) : (
                        <div className="mt-4 text-sm text-white/60">
                          No matching business record found.
                        </div>
                      )}
                    </div>
                  </div>

                  {claim.status === "pending" && (
                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                      <form action={approveClaim}>
                        <input type="hidden" name="claim_id" value={claim.id} />

                        <button
                          type="submit"
                          className="w-full rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                        >
                          Approve claim
                        </button>
                      </form>

                      <form action={rejectClaim} className="space-y-3">
                        <input type="hidden" name="claim_id" value={claim.id} />

                        <textarea
                          name="reason"
                          rows={2}
                          placeholder="Optional rejection reason / admin note"
                          className="w-full rounded-xl border border-red-500/30 bg-black px-4 py-3 text-sm text-white outline-none focus:border-red-400"
                        />

                        <button
                          type="submit"
                          className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                        >
                          Reject claim
                        </button>
                      </form>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AdminGate>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="luxe-card-soft rounded-2xl p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
        {title}
      </div>

      <div className="mt-3 text-3xl font-black text-white">{value}</div>
    </div>
  );
}


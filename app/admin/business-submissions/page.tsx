import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";

import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Admin · Business Submissions | SalahNearMe",
  description: "Review and approve business submissions.",
};

type BusinessSubmission = {
  id: string;
  name: string | null;
  category: string | null;
  country: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  postcode: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  submitted_by_name: string | null;
  submitted_by_email: string | null;
  advertising_interest: boolean | null;
  advertising_type: string | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
};

function cleanSubmissionId(formData: FormData) {
  const submissionId = String(formData.get("submission_id") ?? "").trim();

  if (!submissionId) {
    throw new Error("Missing submission ID.");
  }

  return submissionId;
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  );
}

function formatStatus(status: string | null) {
  if (!status) {
    return "pending";
  }

  return status
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClassName(status: string | null) {
  if (status === "approved") {
    return "border border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (status === "rejected") {
    return "border border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeExternalUrl(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

async function approveSubmission(formData: FormData) {
  "use server";

  const submissionId = cleanSubmissionId(formData);
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/api/admin/business-submissions/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      submission_id: submissionId,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
    };

    throw new Error(data.error ?? "Could not approve submission.");
  }

  revalidatePath("/admin/business-submissions");
  revalidatePath("/admin");
}

async function rejectSubmission(formData: FormData) {
  "use server";

  const submissionId = cleanSubmissionId(formData);
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("business_submissions")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/business-submissions");
  revalidatePath("/admin");
}

function EmptyState() {
  return (
    <section className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-8 text-white/60">
      No business submissions found yet.
    </section>
  );
}

function StatCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "pending" | "approved" | "rejected";
}) {
  const className =
    variant === "approved"
      ? "rounded-2xl border border-green-500/20 bg-green-500/10 p-4"
      : variant === "rejected"
        ? "rounded-2xl border border-red-500/20 bg-red-500/10 p-4"
        : variant === "pending"
          ? "rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4"
          : "rounded-2xl border border-white/10 bg-black/30 p-4";

  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-[0.2em] text-white/50">
        {label}
      </div>

      <div className="mt-2 text-3xl font-black text-white">{value}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null;
  href?: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <span className="text-white/50">{label}:</span>{" "}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-yellow-400 hover:text-yellow-300"
        >
          {value}
        </a>
      ) : (
        <span>{value}</span>
      )}
    </div>
  );
}

function SubmissionCard({ submission }: { submission: BusinessSubmission }) {
  const websiteUrl = normalizeExternalUrl(submission.website);
  const isPending = !submission.status || submission.status === "pending";

  const location = [
    submission.category,
    submission.area,
    submission.city,
    submission.country,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black text-white">
              {submission.name || "Unnamed business"}
            </h2>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${statusClassName(
                submission.status
              )}`}
            >
              {formatStatus(submission.status)}
            </span>
          </div>

          {location && <div className="mt-2 text-white/60">{location}</div>}
        </div>

        <div className="text-sm text-white/50">
          Submitted {formatDate(submission.created_at)}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Business details
          </div>

          <div className="mt-4 space-y-2 text-sm text-white/80">
            <DetailRow label="Address" value={submission.address} />
            <DetailRow label="Postcode" value={submission.postcode} />
            <DetailRow label="Phone" value={submission.phone} />
            <DetailRow label="Business email" value={submission.email} />
            <DetailRow
              label="Website"
              value={submission.website}
              href={websiteUrl}
            />

            {submission.description && (
              <div className="pt-2">
                <div className="text-white/50">Description:</div>
                <div className="mt-1 whitespace-pre-wrap text-white/80">
                  {submission.description}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Submitter details
          </div>

          <div className="mt-4 space-y-2 text-sm text-white/80">
            <DetailRow label="Name" value={submission.submitted_by_name} />
            <DetailRow label="Email" value={submission.submitted_by_email} />

            <div>
              <span className="text-white/50">Advertising interest:</span>{" "}
              {submission.advertising_interest ? "Yes" : "No"}
            </div>

            <DetailRow
              label="Advertising type"
              value={submission.advertising_type}
            />

            {submission.notes && (
              <div className="pt-2">
                <div className="text-white/50">Notes:</div>
                <div className="mt-1 whitespace-pre-wrap text-white/80">
                  {submission.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isPending && (
        <div className="mt-6 flex flex-wrap gap-3">
          <form action={approveSubmission}>
            <input type="hidden" name="submission_id" value={submission.id} />

            <button
              type="submit"
              className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-400"
            >
              Approve and publish
            </button>
          </form>

          <form action={rejectSubmission}>
            <input type="hidden" name="submission_id" value={submission.id} />

            <button
              type="submit"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-300 hover:bg-red-500/20"
            >
              Reject
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

export default async function AdminBusinessSubmissionsPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("business_submissions")
    .select(
      "id,name,category,country,city,area,address,postcode,website,phone,email,description,submitted_by_name,submitted_by_email,advertising_interest,advertising_type,notes,status,created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          {error.message}
        </section>
      </main>
    );
  }

  const submissions = (data ?? []) as BusinessSubmission[];

  const pendingCount = submissions.filter(
    (submission) =>
      !submission.status || submission.status === "pending"
  ).length;

  const approvedCount = submissions.filter(
    (submission) => submission.status === "approved"
  ).length;

  const rejectedCount = submissions.filter(
    (submission) => submission.status === "rejected"
  ).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="space-y-8">
        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Admin
          </div>

          <h1 className="mt-3 text-4xl font-black text-white">
            Business submissions
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">
            Review submitted halal businesses, approve valid listings, reject
            unsuitable submissions, and move approved records into the live
            marketplace.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Pending" value={pendingCount} variant="pending" />
            <StatCard
              label="Approved"
              value={approvedCount}
              variant="approved"
            />
            <StatCard
              label="Rejected"
              value={rejectedCount}
              variant="rejected"
            />
          </div>

          <div className="mt-6">
            <Link
              href="/admin"
              className="text-sm font-bold text-yellow-400 hover:text-yellow-300"
            >
              ← Back to admin
            </Link>
          </div>
        </section>

        {submissions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {submissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
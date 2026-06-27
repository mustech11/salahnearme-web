import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 0;

type QueueRow = {
  id: string;
  entity_type: "mosque" | "business";
  left_id: string;
  right_id: string;
  confidence: number;
  reasons: string[];
  status: "pending" | "resolved" | "ignored";
  resolution: "merge" | "keep_both" | "ignore" | null;
  reviewed_at: string | null;
  created_at: string;
};

type BusinessRow = {
  id: string;
  name: string | null;
  city: string | null;
  postcode: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
};

type MosqueRow = {
  id: string;
  name: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
};

async function runDuplicateScan() {
  "use server";

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/admin/duplicates/scan`, {
    method: "POST",
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? "Could not run duplicate scan");
  }

  revalidatePath("/admin/duplicates");
}

async function reviewDuplicate(formData: FormData) {
  "use server";

  const queueId = String(formData.get("queue_id") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();

  if (!queueId || !action) {
    throw new Error("Missing queue review fields");
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/admin/duplicates/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      queue_id: queueId,
      action,
    }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? "Could not review duplicate");
  }

  revalidatePath("/admin/duplicates");
}

async function mergeBusinessDuplicate(formData: FormData) {
  "use server";

  const queueId = String(formData.get("queue_id") ?? "").trim();
  const primaryId = String(formData.get("primary_id") ?? "").trim();
  const duplicateId = String(formData.get("duplicate_id") ?? "").trim();

  if (!queueId || !primaryId || !duplicateId) {
    throw new Error("Missing merge fields");
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/admin/duplicates/merge-business`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      queue_id: queueId,
      primary_id: primaryId,
      duplicate_id: duplicateId,
    }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? "Could not merge duplicate business");
  }

  revalidatePath("/admin/duplicates");
}

function badgeClass(status: string) {
  if (status === "resolved") {
    return "border border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (status === "ignored") {
    return "border border-white/10 bg-white/5 text-white/70";
  }

  return "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
}

export default async function AdminDuplicatesPage() {
  const supabase = await supabaseServer();

  const [
    { data: queueRaw, error: queueError },
    { data: mosquesRaw, error: mosquesError },
    { data: businessesRaw, error: businessesError },
  ] = await Promise.all([
    supabase
      .from("duplicate_review_queue")
      .select("*")
      .order("confidence", { ascending: false })
      .order("created_at", { ascending: false }),

    supabase
      .from("mosques")
      .select("id,name,city,postcode,address")
      .order("name"),

    supabase
      .from("businesses")
      .select("id,name,city,postcode,phone,website,address")
      .order("name"),
  ]);

  if (queueError) {
    return <pre className="text-white/80">{queueError.message}</pre>;
  }

  if (mosquesError) {
    return <pre className="text-white/80">{mosquesError.message}</pre>;
  }

  if (businessesError) {
    return <pre className="text-white/80">{businessesError.message}</pre>;
  }

  const queue = (queueRaw ?? []) as QueueRow[];
  const mosques = (mosquesRaw ?? []) as MosqueRow[];
  const businesses = (businessesRaw ?? []) as BusinessRow[];

  const mosqueMap = new Map(mosques.map((m) => [m.id, m]));
  const businessMap = new Map(businesses.map((b) => [b.id, b]));

  const pendingCount = queue.filter((q) => q.status === "pending").length;
  const resolvedCount = queue.filter((q) => q.status === "resolved").length;
  const ignoredCount = queue.filter((q) => q.status === "ignored").length;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Admin
            </div>

            <h1 className="mt-3 text-4xl font-bold text-white">
              Duplicate review queue
            </h1>

            <p className="mt-3 max-w-3xl text-white/70">
              Review likely duplicate mosques and businesses before your data gets
              messy. Run a scan, inspect confidence, and resolve each pair.
            </p>
          </div>

          <form action={runDuplicateScan}>
            <button
              type="submit"
              className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              Run duplicate scan
            </button>
          </form>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
              Pending
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {pendingCount}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
              Resolved
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {resolvedCount}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
              Ignored
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {ignoredCount}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/admin"
            className="text-sm font-medium text-yellow-400 hover:text-yellow-300"
          >
            ← Back to admin
          </Link>
        </div>
      </section>

      {queue.length === 0 ? (
        <section className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-8 text-white/60">
          No duplicate candidates found yet.
        </section>
      ) : (
        <div className="space-y-6">
          {queue.map((item) => {
            const left =
              item.entity_type === "mosque"
                ? mosqueMap.get(item.left_id)
                : businessMap.get(item.left_id);

            const right =
              item.entity_type === "mosque"
                ? mosqueMap.get(item.right_id)
                : businessMap.get(item.right_id);

            return (
              <section
                key={item.id}
                className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-2xl font-semibold text-white">
                        {item.entity_type === "mosque"
                          ? "Mosque duplicate"
                          : "Business duplicate"}
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>

                      <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
                        Confidence: {item.confidence}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-white/50">
                      {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="text-xs text-white/40">{item.id}</div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                      Left record
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-white/80">
                      <div>
                        <span className="text-white/50">Name:</span>{" "}
                        {left?.name ?? "—"}
                      </div>
                      <div>
                        <span className="text-white/50">City:</span>{" "}
                        {left?.city ?? "—"}
                      </div>
                      <div>
                        <span className="text-white/50">Postcode:</span>{" "}
                        {left?.postcode ?? "—"}
                      </div>
                      {"phone" in (left ?? {}) && (
                        <div>
                          <span className="text-white/50">Phone:</span>{" "}
                          {(left as BusinessRow)?.phone ?? "—"}
                        </div>
                      )}
                      {"website" in (left ?? {}) && (
                        <div>
                          <span className="text-white/50">Website:</span>{" "}
                          {(left as BusinessRow)?.website ?? "—"}
                        </div>
                      )}
                      <div>
                        <span className="text-white/50">Address:</span>{" "}
                        {left?.address ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                      Right record
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-white/80">
                      <div>
                        <span className="text-white/50">Name:</span>{" "}
                        {right?.name ?? "—"}
                      </div>
                      <div>
                        <span className="text-white/50">City:</span>{" "}
                        {right?.city ?? "—"}
                      </div>
                      <div>
                        <span className="text-white/50">Postcode:</span>{" "}
                        {right?.postcode ?? "—"}
                      </div>
                      {"phone" in (right ?? {}) && (
                        <div>
                          <span className="text-white/50">Phone:</span>{" "}
                          {(right as BusinessRow)?.phone ?? "—"}
                        </div>
                      )}
                      {"website" in (right ?? {}) && (
                        <div>
                          <span className="text-white/50">Website:</span>{" "}
                          {(right as BusinessRow)?.website ?? "—"}
                        </div>
                      )}
                      <div>
                        <span className="text-white/50">Address:</span>{" "}
                        {right?.address ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                      Detection reasons
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-white/80">
                      {item.reasons.map((reason) => (
                        <div key={reason}>• {reason}</div>
                      ))}

                      {item.resolution && (
                        <div className="pt-3 text-white/60">
                          Resolution: {item.resolution}
                        </div>
                      )}

                      {item.reviewed_at && (
                        <div className="text-white/50">
                          Reviewed: {new Date(item.reviewed_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {item.status === "pending" && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {item.entity_type === "business" ? (
                      <Link
                        href={`/admin/duplicates/${item.id}`}
                        className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                      >
                        Preview merge
                      </Link>
                    ) : (
                      <form action={reviewDuplicate}>
                        <input type="hidden" name="queue_id" value={item.id} />
                        <input type="hidden" name="action" value="keep_both" />
                        <button
                          type="submit"
                          className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                        >
                          Keep both
                        </button>
                      </form>
                    )}

                    <form action={reviewDuplicate}>
                      <input type="hidden" name="queue_id" value={item.id} />
                      <input type="hidden" name="action" value="keep_both" />
                      <button
                        type="submit"
                        className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
                      >
                        Keep both
                      </button>
                    </form>

                    <form action={reviewDuplicate}>
                      <input type="hidden" name="queue_id" value={item.id} />
                      <input type="hidden" name="action" value="ignore" />
                      <button
                        type="submit"
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                      >
                        Ignore
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
  );
}


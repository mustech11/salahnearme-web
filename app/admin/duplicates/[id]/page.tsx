import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import BusinessMergeEditor from "@/components/BusinessMergeEditor";

export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type QueueRow = {
  id: string;
  entity_type: "mosque" | "business";
  left_id: string;
  right_id: string;
  confidence: number;
  reasons: string[];
  status: "pending" | "resolved" | "ignored";
};

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  postcode: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean | null;
  featured: boolean | null;
  featured_rank: number | null;
  can_advertise: boolean | null;
  is_claimed: boolean | null;
  pricing_tier: string | null;
  paid_until: string | null;
  sponsor_mosque_id: string | null;
  submitted_by_email: string | null;
  claimed_by_email: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
};

export default async function DuplicateMergePreviewPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: queue, error: queueError } = await supabase
    .from("duplicate_review_queue")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (queueError) {
    return <pre className="text-white/80">{queueError.message}</pre>;
  }

  if (!queue) {
    notFound();
  }

  if (queue.entity_type !== "business") {
    return (
      <div className="space-y-8">
        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Admin
          </div>

          <h1 className="mt-3 text-4xl font-bold text-white">
            Merge preview unavailable
          </h1>

          <p className="mt-3 text-white/70">
            Field-by-field merge is currently enabled for business duplicates only.
          </p>

          <div className="mt-6">
            <Link
              href="/admin/duplicates"
              className="text-sm font-medium text-yellow-400 hover:text-yellow-300"
            >
              ← Back to duplicate queue
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const { data: left, error: leftError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", queue.left_id)
    .maybeSingle();

  const { data: right, error: rightError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", queue.right_id)
    .maybeSingle();

  if (leftError) {
    return <pre className="text-white/80">{leftError.message}</pre>;
  }

  if (rightError) {
    return <pre className="text-white/80">{rightError.message}</pre>;
  }

  if (!left || !right) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Admin
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Field-by-field business merge
        </h1>

        <p className="mt-3 max-w-3xl text-white/70">
          Review each field carefully and choose the best value before merging.
        </p>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/70">
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
            Confidence: {queue.confidence}
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
            Status: {queue.status}
          </span>
        </div>

        <div className="mt-6">
          <Link
            href="/admin/duplicates"
            className="text-sm font-medium text-yellow-400 hover:text-yellow-300"
          >
            ← Back to duplicate queue
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-xl font-semibold text-yellow-400">
          Detection reasons
        </div>

        <div className="mt-4 space-y-2 text-white/80">
          {queue.reasons.map((reason: string) => (
            <div key={reason}>• {reason}</div>
          ))}
        </div>
      </section>

      <BusinessMergeEditor
        queueId={queue.id}
        left={left as BusinessRow}
        right={right as BusinessRow}
      />
    </div>
  );
}
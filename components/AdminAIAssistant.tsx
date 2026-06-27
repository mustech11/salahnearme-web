"use client";

import { useState } from "react";

type Snapshot = {
  generated_at: string;
  launch_readiness: {
    score: number;
    status: string;
    issue_count: number;
  };
  totals: Record<string, number>;
  issues: {
    cities_missing_coordinates: any[];
    cities_missing_current_month_prayer_times: any[];
    businesses_missing_phone_website_address_or_postcode: any[];
    inactive_or_not_live_businesses: any[];
    imported_mosques_needing_review: any[];
    possible_duplicate_mosque_groups: any[][];
  };
};

const starterQuestions = [
  "Which cities need fixing before launch?",
  "Show possible duplicate mosques.",
  "Which businesses are missing important details?",
  "Which cities are missing prayer times?",
  "What should I prioritise before going live?",
  "Suggest the next SEO pages to build.",
];

function scoreClass(score: number) {
  if (score >= 85) return "text-green-300 border-green-500/30 bg-green-500/10";
  if (score >= 65)
    return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
  return "text-red-200 border-red-500/30 bg-red-500/10";
}

export default function AdminAIAssistant() {
  const [password, setPassword] = useState("");
  const [question, setQuestion] = useState(starterQuestions[0]);
  const [answer, setAnswer] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [error, setError] = useState("");

  async function loadSnapshot() {
    setLoadingSnapshot(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/ai-assistant?password=${encodeURIComponent(password)}`
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || data.error || "Snapshot request failed");
        return;
      }

      setSnapshot(data.snapshot);
    } catch {
      setError("Failed to load admin dashboard snapshot.");
    } finally {
      setLoadingSnapshot(false);
    }
  }

  async function askAssistant(nextQuestion?: string) {
    const finalQuestion = nextQuestion ?? question;

    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const res = await fetch("/api/admin/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
          question: finalQuestion,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || data.error || "Request failed");
        return;
      }

      setAnswer(data.answer ?? "No answer returned.");
      setSnapshot(data.snapshot ?? null);
    } catch {
      setError("Failed to contact AI assistant.");
    } finally {
      setLoading(false);
    }
  }

  function exportReport() {
    if (!snapshot) return;

    const text = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `salahnearme-admin-report-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Admin AI Assistant
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          SalahNearMe AI Admin Dashboard
        </h1>

        <p className="mt-4 max-w-3xl text-white/70">
          Phase 1.5 is still read-only. It analyses launch readiness, prayer
          times, coordinates, duplicates, imported mosques, and business data
          quality without changing Supabase.
        </p>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
        <label className="block text-sm font-semibold text-yellow-400">
          Admin password
        </label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter ADMIN_AI_PASSWORD"
          className="mt-2 w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadSnapshot}
            disabled={loadingSnapshot || !password}
            className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-4 font-semibold text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50"
          >
            {loadingSnapshot ? "Loading dashboard..." : "Load dashboard"}
          </button>

          <button
            type="button"
            onClick={exportReport}
            disabled={!snapshot}
            className="rounded-2xl border border-white/10 bg-black px-6 py-4 font-semibold text-white/70 hover:border-yellow-500/30 hover:text-yellow-400 disabled:opacity-50"
          >
            Export report
          </button>
        </div>
      </section>

      {snapshot && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div
              className={`rounded-3xl border p-6 ${scoreClass(
                snapshot.launch_readiness.score
              )}`}
            >
              <div className="text-sm uppercase tracking-[0.2em]">
                Launch Score
              </div>
              <div className="mt-3 text-5xl font-bold">
                {snapshot.launch_readiness.score}
              </div>
              <div className="mt-2 text-sm">
                {snapshot.launch_readiness.status}
              </div>
            </div>

            <Metric
              title="Cities"
              value={snapshot.totals.cities}
              note="Active cities"
            />

            <Metric
              title="Mosques"
              value={snapshot.totals.mosques}
              note="Active mosques"
            />

            <Metric
              title="Businesses"
              value={snapshot.totals.businesses}
              note="Total businesses"
            />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <IssueCard
              title="Missing prayer times"
              count={snapshot.totals.cities_missing_prayer_times}
              items={snapshot.issues.cities_missing_current_month_prayer_times}
              field="name"
            />

            <IssueCard
              title="Missing coordinates"
              count={snapshot.totals.cities_missing_coordinates}
              items={snapshot.issues.cities_missing_coordinates}
              field="name"
            />

            <IssueCard
              title="Business data gaps"
              count={snapshot.totals.businesses_missing_data}
              items={
                snapshot.issues
                  .businesses_missing_phone_website_address_or_postcode
              }
              field="name"
            />

            <IssueCard
              title="Not live businesses"
              count={snapshot.totals.inactive_or_not_live_businesses}
              items={snapshot.issues.inactive_or_not_live_businesses}
              field="name"
            />

            <IssueCard
              title="Imported mosques to review"
              count={snapshot.totals.imported_mosques_needing_review}
              items={snapshot.issues.imported_mosques_needing_review}
              field="name"
            />

            <DuplicateGroups
              groups={snapshot.issues.possible_duplicate_mosque_groups}
              count={snapshot.totals.possible_duplicate_mosque_groups}
            />
          </section>
        </>
      )}

      <section className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
        <label className="block text-sm font-semibold text-yellow-400">
          Ask a question
        </label>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
          className="mt-2 w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
        />

        <button
          type="button"
          onClick={() => askAssistant()}
          disabled={loading || !password || !question.trim()}
          className="mt-4 rounded-2xl bg-yellow-500 px-6 py-4 font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask AI Assistant"}
        </button>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {starterQuestions.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setQuestion(item);
              askAssistant(item);
            }}
            disabled={loading || !password}
            className="rounded-2xl border border-yellow-500/20 bg-black/30 p-4 text-left text-sm text-white/80 hover:border-yellow-400/50 disabled:opacity-50"
          >
            {item}
          </button>
        ))}
      </section>

      {error && (
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
          {error}
        </section>
      )}

      {answer && (
        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Assistant Response
          </div>

          <div className="mt-4 whitespace-pre-wrap leading-relaxed text-white/80">
            {answer}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({
  title,
  value,
  note,
}: {
  title: string;
  value: number;
  note: string;
}) {
  return (
    <div className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
        {title}
      </div>
      <div className="mt-3 text-4xl font-bold text-white">{value}</div>
      <div className="mt-2 text-sm text-white/50">{note}</div>
    </div>
  );
}

function IssueCard({
  title,
  count,
  items,
  field,
}: {
  title: string;
  count: number;
  items: any[];
  field: string;
}) {
  return (
    <div className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-bold text-yellow-400">{title}</div>
        <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-sm font-bold text-yellow-400">
          {count}
        </div>
      </div>

      <div className="mt-4 max-h-72 space-y-2 overflow-auto pr-1">
        {items.length === 0 ? (
          <div className="text-sm text-white/50">No issues found.</div>
        ) : (
          items.slice(0, 20).map((item, index) => (
            <div
              key={`${item.id ?? index}-${item[field] ?? "item"}`}
              className="rounded-xl border border-white/10 bg-black/40 p-3"
            >
              <div className="font-semibold text-white">
                {item[field] ?? "Unnamed"}
              </div>

              <div className="mt-1 text-xs text-white/50">
                {item.slug ?? item.city ?? item.postcode ?? "No extra detail"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DuplicateGroups({
  groups,
  count,
}: {
  groups: any[][];
  count: number;
}) {
  return (
    <div className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-bold text-yellow-400">
          Duplicate mosque groups
        </div>
        <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-sm font-bold text-yellow-400">
          {count}
        </div>
      </div>

      <div className="mt-4 max-h-72 space-y-3 overflow-auto pr-1">
        {groups.length === 0 ? (
          <div className="text-sm text-white/50">No duplicate groups found.</div>
        ) : (
          groups.slice(0, 10).map((group, index) => (
            <div
              key={index}
              className="rounded-xl border border-white/10 bg-black/40 p-3"
            >
              <div className="text-sm font-semibold text-white">
                Group {index + 1} · {group.length} records
              </div>

              <div className="mt-2 space-y-1">
                {group.map((mosque: any) => (
                  <div key={mosque.id} className="text-xs text-white/60">
                    {mosque.name ?? "Unnamed mosque"} ·{" "}
                    {mosque.postcode ?? "No postcode"}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


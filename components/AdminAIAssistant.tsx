"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_QUESTION_LENGTH = 1_500;

type Snapshot = {
  generated_at: string;
  launch_readiness: {
    score: number;
    status: string;
    issue_count: number;
  };
  totals: Record<string, number>;
  issues: {
    cities_missing_coordinates: Record<string, unknown>[];
    cities_missing_current_month_prayer_times: Record<string, unknown>[];
    businesses_missing_phone_website_address_or_postcode: Record<string, unknown>[];
    inactive_or_not_live_businesses: Record<string, unknown>[];
    imported_mosques_needing_review: Record<string, unknown>[];
    possible_duplicate_mosque_groups: Record<string, unknown>[][];
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
  const requestControllerRef = useRef<AbortController | null>(null);
  const [password, setPassword] = useState("");
  const [question, setQuestion] = useState(starterQuestions[0]);
  const [answer, setAnswer] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    return () => {
      requestControllerRef.current?.abort();
    };
  }, []);

  const issueTotal = useMemo(() => {
    if (!snapshot) return 0;
    return Object.values(snapshot.totals).reduce(
      (total, value) => total + (Number.isFinite(value) ? value : 0),
      0
    );
  }, [snapshot]);

  async function request(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    requestControllerRef.current?.abort();

    const controller = new AbortController();
    requestControllerRef.current = controller;
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      return await fetch(input, {
        ...init,
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeoutId);

      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
    }
  }

  async function loadSnapshot() {
    setLoadingSnapshot(true);
    setError("");

    try {
      const res = await request(
        `/api/admin/ai-assistant?password=${encodeURIComponent(password)}`,
        { headers: { Accept: "application/json" } }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || data.error || "Snapshot request failed");
        return;
      }

      setSnapshot(data.snapshot);
      setLastUpdatedAt(new Date());
    } catch (error) {
      setError(
        error instanceof DOMException && error.name === "AbortError"
          ? "The dashboard snapshot request timed out."
          : "Failed to load admin dashboard snapshot."
      );
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
      const res = await request("/api/admin/ai-assistant", {
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
      setLastUpdatedAt(new Date());
    } catch (error) {
      setError(
        error instanceof DOMException && error.name === "AbortError"
          ? "The AI assistant request timed out."
          : "Failed to contact AI assistant."
      );
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
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/45">
            <span>
              Snapshot generated{" "}
              {new Date(snapshot.generated_at).toLocaleString("en-GB")}
            </span>
            <span>
              {issueTotal.toLocaleString("en-GB")} total measured records
            </span>
            {lastUpdatedAt ? (
              <span>
                Refreshed{" "}
                {lastUpdatedAt.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
          </section>
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
          maxLength={MAX_QUESTION_LENGTH}
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
  items: Record<string, unknown>[];
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
              key={`${String(item.id ?? index)}-${String(item[field] ?? "item")}`}
              className="rounded-xl border border-white/10 bg-black/40 p-3"
            >
              <div className="font-semibold text-white">
                {String(item[field] ?? "Unnamed")}
              </div>

              <div className="mt-1 text-xs text-white/50">
                {String(item.slug ?? item.city ?? item.postcode ?? "No extra detail")}
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
  groups: Record<string, unknown>[][];
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
                {group.map((mosque, mosqueIndex) => (
                  <div
                    key={String(mosque.id ?? mosqueIndex)}
                    className="text-xs text-white/60"
                  >
                    {String(mosque.name ?? "Unnamed mosque")} ·{" "}
                    {String(mosque.postcode ?? "No postcode")}
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

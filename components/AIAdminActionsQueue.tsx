"use client";

import { useMemo, useState } from "react";

type AIAction = {
  id: string;
  action_type: string;
  title: string;
  reason: string | null;
  risk_level: "low" | "medium" | "high" | string;
  status: "pending" | "approved" | "rejected" | string;
  payload: Record<string, unknown>;
  created_at: string;
};

const statusOptions = ["all", "pending", "approved", "rejected"] as const;

function riskClass(risk: string) {
  if (risk === "high") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (risk === "medium")
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  return "border-green-500/30 bg-green-500/10 text-green-300";
}

function statusClass(status: string) {
  if (status === "approved")
    return "border-green-500/30 bg-green-500/10 text-green-300";
  if (status === "rejected")
    return "border-red-500/30 bg-red-500/10 text-red-200";
  return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
}

export default function AIAdminActionsQueue() {
  const [password, setPassword] = useState("");
  const [actions, setActions] = useState<AIAction[]>([]);
  const [statusFilter, setStatusFilter] =
    useState<(typeof statusOptions)[number]>("pending");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const filteredActions = useMemo(() => {
    if (statusFilter === "all") return actions;
    return actions.filter((a) => a.status === statusFilter);
  }, [actions, statusFilter]);

  async function loadActions() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(
        `/api/admin/ai-actions?password=${encodeURIComponent(password)}`
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to load actions");
        return;
      }

      setActions(data.actions ?? []);
    } catch {
      setError("Failed to load actions.");
    } finally {
      setLoading(false);
    }
  }

  async function generateActions() {
    setGenerating(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/ai-actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
          mode: "generate",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to generate actions");
        return;
      }

      setMessage(`Generated ${data.inserted ?? 0} pending actions.`);
      await loadActions();
    } catch {
      setError("Failed to generate actions.");
    } finally {
      setGenerating(false);
    }
  }

  async function updateStatus(
    actionId: string,
    status: "approved" | "rejected" | "pending"
  ) {
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/ai-actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
          mode: "update_status",
          action_id: actionId,
          status,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to update action");
        return;
      }

      setActions((current) =>
        current.map((action) =>
          action.id === actionId ? { ...action, status } : action
        )
      );

      setMessage(`Action marked as ${status}. No database changes were made.`);
    } catch {
      setError("Failed to update action.");
    }
  }

  function exportActions() {
    const blob = new Blob([JSON.stringify(filteredActions, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `salahnearme-ai-actions-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          AI Admin Actions
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Approval Queue
        </h1>

        <p className="mt-4 max-w-3xl text-white/70">
          AI can suggest actions, but nothing is changed automatically. Approving
          an item only marks it as approved for now. Database writes come later
          in a controlled Phase 3.
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
            onClick={loadActions}
            disabled={loading || !password}
            className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-4 font-semibold text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load queue"}
          </button>

          <button
            type="button"
            onClick={generateActions}
            disabled={generating || !password}
            className="rounded-2xl bg-yellow-500 px-6 py-4 font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate suggestions"}
          </button>

          <button
            type="button"
            onClick={exportActions}
            disabled={filteredActions.length === 0}
            className="rounded-2xl border border-white/10 bg-black px-6 py-4 font-semibold text-white/70 hover:border-yellow-500/30 hover:text-yellow-400 disabled:opacity-50"
          >
            Export visible
          </button>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        {statusOptions.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={
              statusFilter === status
                ? "rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-black"
                : "rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            }
          >
            {status}
          </button>
        ))}
      </section>

      {error && (
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
          {error}
        </section>
      )}

      {message && (
        <section className="rounded-3xl border border-green-500/20 bg-green-500/10 p-6 text-green-300">
          {message}
        </section>
      )}

      <section className="grid gap-4">
        {filteredActions.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/30 p-8 text-white/60">
            No actions found. Click “Generate suggestions”.
          </div>
        ) : (
          filteredActions.map((action) => (
            <div
              key={action.id}
              className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskClass(
                        action.risk_level
                      )}`}
                    >
                      {action.risk_level} risk
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
                        action.status
                      )}`}
                    >
                      {action.status}
                    </span>

                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/60">
                      {action.action_type}
                    </span>
                  </div>

                  <h2 className="mt-4 text-2xl font-bold text-white">
                    {action.title}
                  </h2>

                  {action.reason && (
                    <p className="mt-3 max-w-4xl text-white/70">
                      {action.reason}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateStatus(action.id, "approved")}
                    disabled={action.status === "approved"}
                    className="rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-black hover:bg-green-400 disabled:opacity-40"
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    onClick={() => updateStatus(action.id, "rejected")}
                    disabled={action.status === "rejected"}
                    className="rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-40"
                  >
                    Reject
                  </button>

                  <button
                    type="button"
                    onClick={() => updateStatus(action.id, "pending")}
                    disabled={action.status === "pending"}
                    className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-40"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <details className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-yellow-400">
                  View payload
                </summary>

                <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-white/60">
                  {JSON.stringify(action.payload, null, 2)}
                </pre>
              </details>
            </div>
          ))
        )}
      </section>
    </div>
  );
}


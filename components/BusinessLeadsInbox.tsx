"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type Props = {
  businessId: string;
};

type LeadStatus = "new" | "contacted" | "won" | "lost" | "archived";

type Lead = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  subject: string | null;
  message: string | null;
  status: LeadStatus;
  lead_type: string | null;
  created_at: string;
  updated_at?: string | null;
};

type LeadsResponse = {
  ok?: boolean;
  error?: string;
  leads?: Lead[];
};

type LoadState = "loading" | "success" | "error";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 20_000;
const AUTO_REFRESH_MS = 120_000;
const STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "won",
  "lost",
  "archived",
];

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isLeadStatus(value: unknown): value is LeadStatus {
  return STATUSES.includes(value as LeadStatus);
}

function badgeClass(status: LeadStatus): string {
  if (status === "new") {
    return "border-blue-500/20 bg-blue-500/10 text-blue-300";
  }

  if (status === "contacted") {
    return "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";
  }

  if (status === "won") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "lost") {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }

  return "border-white/10 bg-white/5 text-white/50";
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function readJson(response: Response): Promise<LeadsResponse> {
  try {
    const value: unknown = await response.json();

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as LeadsResponse;
  } catch {
    return {};
  }
}

export default function BusinessLeadsInbox({ businessId }: Props) {
  const headingId = useId();
  const feedbackId = useId();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const cleanBusinessId = cleanText(businessId);

  const load = useCallback(async () => {
    if (!UUID_REGEX.test(cleanBusinessId)) {
      setLoadState("error");
      setErrorMessage("A valid business is required to load enquiries.");
      return;
    }

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let timedOut = false;

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setLoadState("loading");
    setErrorMessage("");

    try {
      const params = new URLSearchParams({
        business_id: cleanBusinessId,
      });

      const response = await fetch(
        `/api/business-leads/list?${params.toString()}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const data = await readJson(response);

      if (!response.ok || data.ok === false) {
        setLoadState("error");
        setErrorMessage(cleanText(data.error) || "Could not load enquiries.");
        return;
      }

      const safeLeads = Array.isArray(data.leads)
        ? data.leads
            .filter(
              (lead) =>
                typeof lead?.id === "string" &&
                lead.id.length > 0 &&
                isLeadStatus(lead.status)
            )
            .sort(
              (first, second) =>
                new Date(second.created_at).getTime() -
                new Date(first.created_at).getTime()
            )
        : [];

      setLeads(safeLeads);
      setLastUpdatedAt(new Date());
      setLoadState("success");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? timedOut
            ? "The enquiry request timed out."
            : "The enquiry request was cancelled."
          : "Could not load enquiries."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [cleanBusinessId]);

  useEffect(() => {
    void load();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
      abortControllerRef.current?.abort();
    };
  }, [load]);

  async function updateStatus(leadId: string, status: LeadStatus) {
    if (!leadId || updatingId) return;

    const current = leads.find((lead) => lead.id === leadId);

    if (!current || current.status === status) return;

    const previousStatus = current.status;

    setUpdatingId(leadId);
    setErrorMessage("");
    setMessage("");
    setLeads((items) =>
      items.map((lead) =>
        lead.id === leadId
          ? { ...lead, status, updated_at: new Date().toISOString() }
          : lead
      )
    );

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch("/api/business-leads/update", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          lead_id: leadId,
          status,
        }),
      });

      const data = await readJson(response);

      if (!response.ok || data.ok === false) {
        throw new Error(cleanText(data.error) || "Could not update the lead.");
      }

      setMessage(`Lead marked as ${formatLabel(status)}.`);
    } catch (error) {
      setLeads((items) =>
        items.map((lead) =>
          lead.id === leadId ? { ...lead, status: previousStatus } : lead
        )
      );

      setErrorMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "The lead update timed out."
          : error instanceof Error
            ? error.message
            : "Could not update the lead."
      );
    } finally {
      window.clearTimeout(timeoutId);
      setUpdatingId(null);
    }
  }

  const stats = useMemo(
    () => ({
      total: leads.length,
      new: leads.filter((lead) => lead.status === "new").length,
      contacted: leads.filter((lead) => lead.status === "contacted").length,
      won: leads.filter((lead) => lead.status === "won").length,
    }),
    [leads]
  );

  const visibleLeads = useMemo(() => {
    const term = search.trim().toLowerCase();

    return leads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) {
        return false;
      }

      if (!term) return true;

      return [
        lead.customer_name,
        lead.customer_email,
        lead.customer_phone,
        lead.subject,
        lead.message,
        lead.lead_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [leads, search, statusFilter]);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-5 sm:p-6"
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Leads inbox
          </div>

          <h2
            id={headingId}
            className="mt-2 text-3xl font-black tracking-tight text-white"
          >
            Customer enquiries
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
            Manage incoming customer messages and track every enquiry from new
            lead to conversion.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="New" value={stats.new} />
          <StatCard label="Contacted" value={stats.contacted} />
          <StatCard label="Won" value={stats.won} />
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email, subject or message"
          className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-yellow-400"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as LeadStatus | "all")
          }
          className="min-h-11 rounded-xl border border-white/10 bg-black px-4 py-2.5 text-sm font-semibold text-white outline-none focus:border-yellow-400"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatLabel(status)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loadState === "loading"}
          className="min-h-11 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm font-bold text-yellow-300 transition hover:bg-yellow-500/20 disabled:cursor-wait disabled:opacity-50"
        >
          {loadState === "loading" ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div id={feedbackId} aria-live="polite">
        {errorMessage ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}

        {message ? (
          <div
            role="status"
            className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
          >
            {message}
          </div>
        ) : null}

        {lastUpdatedAt ? (
          <p className="mt-3 text-xs text-white/35">
            Updated{" "}
            {lastUpdatedAt.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : null}
      </div>

      {loadState === "loading" && leads.length === 0 ? (
        <LoadingState />
      ) : (
        <div className="mt-6 space-y-4">
          {visibleLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              updating={updatingId === lead.id}
              onStatusChange={(status) => void updateStatus(lead.id, status)}
            />
          ))}

          {visibleLeads.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-10 text-center">
              <div className="font-bold text-white">No enquiries found</div>
              <p className="mt-2 text-sm text-white/50">
                Try a different filter or search term.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function LeadCard({
  lead,
  updating,
  onStatusChange,
}: {
  lead: Lead;
  updating: boolean;
  onStatusChange: (status: LeadStatus) => void;
}) {
  return (
    <article className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-black text-white">
              {cleanText(lead.customer_name) || "Anonymous"}
            </h3>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeClass(
                lead.status
              )}`}
            >
              {formatLabel(lead.status)}
            </span>

            {lead.lead_type ? (
              <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-300">
                {formatLabel(lead.lead_type)}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {lead.customer_email ? (
              <a
                href={`mailto:${lead.customer_email}`}
                className="text-cyan-300 hover:text-cyan-200"
              >
                {lead.customer_email}
              </a>
            ) : null}

            {lead.customer_phone ? (
              <a
                href={`tel:${lead.customer_phone}`}
                className="text-cyan-300 hover:text-cyan-200"
              >
                {lead.customer_phone}
              </a>
            ) : null}
          </div>

          {lead.subject ? (
            <div className="mt-5 text-lg font-bold text-yellow-300">
              {lead.subject}
            </div>
          ) : null}

          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-white/75">
            {cleanText(lead.message) || "No message supplied."}
          </p>

          <div className="mt-5 flex flex-wrap gap-4 text-xs text-white/40">
            <span>Created: {formatDate(lead.created_at)}</span>
            {lead.updated_at ? (
              <span>Updated: {formatDate(lead.updated_at)}</span>
            ) : null}
          </div>
        </div>

        <div className="xl:w-[220px]">
          <label
            htmlFor={`lead-status-${lead.id}`}
            className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-yellow-300"
          >
            Lead status
          </label>

          <select
            id={`lead-status-${lead.id}`}
            value={lead.status}
            disabled={updating}
            onChange={(event) =>
              onStatusChange(event.target.value as LeadStatus)
            }
            className="min-h-11 w-full rounded-xl border border-white/10 bg-black px-4 py-2.5 text-sm font-semibold text-white outline-none focus:border-yellow-400 disabled:cursor-wait disabled:opacity-60"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>

          <p className="mt-2 text-xs text-white/35">
            {updating ? "Saving status…" : "Status changes save immediately."}
          </p>
        </div>
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="mt-6 space-y-4" aria-busy="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-white/10 bg-black/30 p-5"
        >
          <div className="h-5 w-48 rounded bg-white/10" />
          <div className="mt-4 h-4 w-72 rounded bg-white/10" />
          <div className="mt-5 h-16 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-yellow-500/20 bg-black/30 p-4 text-center">
      <div className="text-xs uppercase tracking-[0.18em] text-yellow-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}
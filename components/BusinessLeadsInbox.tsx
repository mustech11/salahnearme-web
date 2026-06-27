"use client";

import { useEffect, useState } from "react";

type Props = {
  businessId: string;
};

type LeadStatus =
  | "new"
  | "contacted"
  | "won"
  | "lost"
  | "archived";

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

const statuses: LeadStatus[] = [
  "new",
  "contacted",
  "won",
  "lost",
  "archived",
];

function badgeClass(status: LeadStatus) {
  switch (status) {
    case "new":
      return "border-blue-500/20 bg-blue-500/10 text-blue-300";

    case "contacted":
      return "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";

    case "won":
      return "border-green-500/20 bg-green-500/10 text-green-300";

    case "lost":
      return "border-red-500/20 bg-red-500/10 text-red-300";

    case "archived":
      return "border-white/10 bg-white/5 text-white/50";

    default:
      return "border-white/10 bg-white/5 text-white";
  }
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function BusinessLeadsInbox({
  businessId,
}: Props) {
  const [leads, setLeads] =
    useState<Lead[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/business-leads/list?business_id=${businessId}`
      );

      const json = await res.json();

      setLeads(json.leads ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(
    leadId: string,
    status: LeadStatus
  ) {
    try {
      setUpdatingId(leadId);

      const res = await fetch(
        "/api/business-leads/update",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            lead_id: leadId,
            status,
          }),
        }
      );

      if (res.ok) {
        setLeads((prev) =>
          prev.map((lead) =>
            lead.id === leadId
              ? {
                  ...lead,
                  status,
                }
              : lead
          )
        );
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingId(null);
    }
  }

  useEffect(() => {
    load();
  }, [businessId]);

  const stats = {
    total: leads.length,

    new: leads.filter(
      (x) => x.status === "new"
    ).length,

    contacted: leads.filter(
      (x) =>
        x.status === "contacted"
    ).length,

    won: leads.filter(
      (x) => x.status === "won"
    ).length,
  };

  return (
    <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
      <div className="mb-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Leads Inbox
          </div>

          <div className="mt-2 text-3xl font-black text-white">
            Customer Enquiries
          </div>

          <p className="mt-2 text-sm text-white/60">
            Manage customer
            enquiries and track
            conversion progress.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Total"
            value={stats.total}
          />

          <StatCard
            label="New"
            value={stats.new}
          />

          <StatCard
            label="Contacted"
            value={stats.contacted}
          />

          <StatCard
            label="Won"
            value={stats.won}
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-yellow-500/20 bg-black/30 p-6 text-white/60">
          Loading enquiries...
        </div>
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-xl font-bold text-white">
                      {lead.customer_name ??
                        "Anonymous"}
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                        lead.status
                      )}`}
                    >
                      {formatLabel(
                        lead.status
                      )}
                    </span>

                    {lead.lead_type && (
                      <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-300">
                        {formatLabel(
                          lead.lead_type
                        )}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/60">
                    {lead.customer_email && (
                      <div>
                        {lead.customer_email}
                      </div>
                    )}

                    {lead.customer_phone && (
                      <div>
                        {
                          lead.customer_phone
                        }
                      </div>
                    )}
                  </div>

                  {lead.subject && (
                    <div className="mt-5 text-lg font-semibold text-yellow-400">
                      {lead.subject}
                    </div>
                  )}

                  <div className="mt-3 whitespace-pre-wrap text-white/75">
                    {lead.message}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-4 text-xs text-white/40">
                    <div>
                      Created:{" "}
                      {new Date(
                        lead.created_at
                      ).toLocaleString()}
                    </div>

                    {lead.updated_at && (
                      <div>
                        Updated:{" "}
                        {new Date(
                          lead.updated_at
                        ).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="xl:w-[220px]">
                  <div className="mb-3 text-xs uppercase tracking-[0.2em] text-yellow-400">
                    Lead Status
                  </div>

                  <div className="grid gap-2">
                    {statuses.map(
                      (status) => {
                        const active =
                          lead.status ===
                          status;

                        return (
                          <button
                            key={status}
                            disabled={
                              updatingId ===
                              lead.id
                            }
                            onClick={() =>
                              updateStatus(
                                lead.id,
                                status
                              )
                            }
                            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                              active
                                ? "border-yellow-500 bg-yellow-500 text-black"
                                : "border-white/10 bg-black/20 text-white hover:border-yellow-500/40"
                            }`}
                          >
                            {formatLabel(
                              status
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {leads.length === 0 && (
            <div className="rounded-2xl border border-yellow-500/20 bg-black/30 p-10 text-center text-white/60">
              No enquiries yet.
            </div>
          )}
        </div>
      )}
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
      <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black text-white">
        {value}
      </div>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

type Props = {
  businessId: string;
};

export default function BusinessDashboardNotifications({ businessId }: Props) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadNotifications() {
    setLoading(true);

    const res = await fetch(
      `/api/business-dashboard/notifications?business_id=${businessId}`,
      { cache: "no-store" }
    );

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok) {
      setItems(data.notifications ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadNotifications();
  }, [businessId]);

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
        Notifications
      </div>

      <h2 className="mt-3 text-3xl font-black text-white">
        Business updates
      </h2>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="text-white/60">Loading notifications...</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-white/60">
            No notifications yet.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-bold text-white">{item.title}</div>

                  {item.body && (
                    <div className="mt-2 text-sm text-white/65">
                      {item.body}
                    </div>
                  )}
                </div>

                {!item.read && (
                  <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                    New
                  </span>
                )}
              </div>

              <div className="mt-3 text-xs text-white/40">
                {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}


"use client";

import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function SortableFeaturedRow({
  id,
  name,
  category,
}: {
  id: string;
  name: string;
  category?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

 const style: any = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="mt-1 text-xs text-white/60">{category ?? "Business"}</div>
      </div>

      <button
        className="cursor-grab rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
      >
        ↕ Drag
      </button>
    </div>
  );
}

function isoToDateInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function dateInputToIso(v: string) {
  // end of day
  const d = new Date(`${v}T23:59:59.999Z`);
  return d.toISOString();
}

export default function AdminBusinessesClient({
  initialBusinesses,
  mosques,
}: {
  initialBusinesses: any[];
  mosques: any[];
}) {
  const [rows, setRows] = useState<any[]>(initialBusinesses);
  const [q, setQ] = useState("");

  const mosqueOptions = useMemo(
    () =>
      mosques.map((m) => ({
        id: m.id,
        label: `${m.name}${m.area ? ` — ${m.area}` : ""}${m.postcode ? ` (${m.postcode})` : ""}`,
      })),
    [mosques]
  );

  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.name, r.category, r.city, r.postcode].filter(Boolean).join(" ").toLowerCase().includes(t)
    );
  }, [rows, q]);

  // ✅ Featured-only list for DnD (sorted by rank)
  const featured = useMemo(() => {
    return [...rows]
      .filter((r) => r.featured === true && r.active !== false)
      .sort((a, b) => (a.featured_rank ?? 999) - (b.featured_rank ?? 999));
  }, [rows]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  async function saveFeaturedOrder(orderedIds: string[]) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return alert("You must be logged in as admin.");

    const res = await fetch("/api/admin/businesses/reorder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderedIds }),
    });

    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alert(d?.error ?? "Reorder failed");
  }

  async function onDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = featured.findIndex((x) => x.id === active.id);
    const newIndex = featured.findIndex((x) => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const moved = arrayMove(featured, oldIndex, newIndex);

    // Update local state ranks immediately (1..N)
    const rankMap = new Map<string, number>();
    moved.forEach((x, idx) => rankMap.set(x.id, idx + 1));

    setRows((prev) =>
      prev.map((r) =>
        rankMap.has(r.id) ? { ...r, featured_rank: rankMap.get(r.id) } : r
      )
    );

    // Persist
    await saveFeaturedOrder(moved.map((x) => x.id));
  }

  async function adminUpdate(id: string, patch: Record<string, any>) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return alert("You must be logged in as admin.");

    const res = await fetch("/api/admin/businesses/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...patch }),
    });

    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alert(d?.error ?? "Update failed");

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search businesses..."
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
        />
      </div>

      {/* ✅ Drag & Drop Featured Ranking */}
      <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Featured ranking</div>
            <div className="mt-1 text-xs text-white/60">
              Drag to reorder. Ranks auto-save as 1..N.
            </div>
          </div>
          <div className="text-xs text-white/50">{featured.length} featured</div>
        </div>

        <div className="mt-4">
          {featured.length === 0 ? (
            <div className="text-xs text-white/60">No featured businesses yet.</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={featured.map((x) => x.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {featured.map((b) => (
                    <SortableFeaturedRow
                      key={b.id}
                      id={b.id}
                      name={b.name}
                      category={b.category}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map((b) => (
          <div key={b.id} className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{b.name}</div>
                <div className="text-xs text-white/60">{b.category} • {b.city}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={!!b.active}
                    onChange={(e) => adminUpdate(b.id, { active: e.target.checked })}
                  />
                  Active
                </label>

                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={!!b.featured}
                    onChange={(e) => adminUpdate(b.id, { featured: e.target.checked })}
                  />
                  Featured
                </label>

                
                <input
                  type="date"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
                  value={isoToDateInput(b.featured_until)}
                  onChange={(e) =>
                    adminUpdate(b.id, { featured_until: e.target.value ? dateInputToIso(e.target.value) : null })
                  }
                  title="Featured until"
                />

                <select
                  className="max-w-[320px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
                  value={b.sponsor_mosque_id ?? ""}
                  onChange={(e) => adminUpdate(b.id, { sponsor_mosque_id: e.target.value || null })}
                  title="Sponsor mosque (optional)"
                >
                  <option value="">No sponsored mosque</option>
                  {mosqueOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
                value={b.website ?? ""}
                onChange={(e) => adminUpdate(b.id, { website: e.target.value })}
                placeholder="Website"
              />
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
                value={b.phone ?? ""}
                onChange={(e) => adminUpdate(b.id, { phone: e.target.value })}
                placeholder="Phone"
              />
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
                value={b.maps_url ?? ""}
                onChange={(e) => adminUpdate(b.id, { maps_url: e.target.value })}
                placeholder="Maps URL"
              />
            </div>

            <div className="mt-2 text-[10px] text-white/40">
              Tip: Set <b>Featured</b> + <b>Rank</b> + <b>Expiry</b>. Set sponsor mosque only for premium sponsorship.
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


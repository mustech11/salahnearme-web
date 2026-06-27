export default function FridaySmartCard({
  jumuah_sittings,
  khutbah_language,
  typical_full_by,
  notes,
}: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-5">
      <div className="text-sm font-semibold">Friday Smart Mode</div>
      <p className="mt-1 text-xs text-white/60">
        Community guidance — may vary weekly.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] text-white/60">Sittings</div>
          <div className="mt-1 font-semibold">{jumuah_sittings ?? "Unknown"}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] text-white/60">Khutbah</div>
          <div className="mt-1 font-semibold">{khutbah_language ?? "Not listed"}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] text-white/60">Often busy by</div>
          <div className="mt-1 font-semibold">{typical_full_by ?? "—"}</div>
        </div>
      </div>

      {notes && <p className="mt-4 text-sm text-white/70">{notes}</p>}
    </div>
  );
}


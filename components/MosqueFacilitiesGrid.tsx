type Props = {
  womens_space?: boolean | null;
  parking?: boolean | null;
  wheelchair_access?: boolean | null;
  children_classes?: boolean | null;
  nikah_service?: boolean | null;
  janazah_service?: boolean | null;
  wudu_facilities?: boolean | null;
  sisters_entrance?: boolean | null;
  imam_name?: string | null;
  languages?: string[] | null;
  facilities_notes?: string | null;
};

function statusLabel(value: boolean | null | undefined) {
  if (value === true) return "Available";
  if (value === false) return "Not available";
  return "Unknown";
}

export default function MosqueFacilitiesGrid({
  womens_space,
  parking,
  wheelchair_access,
  children_classes,
  nikah_service,
  janazah_service,
  wudu_facilities,
  sisters_entrance,
  imam_name,
  languages,
  facilities_notes,
}: Props) {
  const items = [
    ["Women’s Space", statusLabel(womens_space)],
    ["Parking", statusLabel(parking)],
    ["Wheelchair Access", statusLabel(wheelchair_access)],
    ["Children’s Classes", statusLabel(children_classes)],
    ["Nikah Service", statusLabel(nikah_service)],
    ["Janazah Service", statusLabel(janazah_service)],
    ["Wudu Facilities", statusLabel(wudu_facilities)],
    ["Sisters’ Entrance", statusLabel(sisters_entrance)],
    ["Imam", imam_name || "Unknown"],
    ["Languages", languages?.length ? languages.join(", ") : "Unknown"],
  ];

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="text-2xl font-semibold text-yellow-400">
        Facilities & Services
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-black/30 p-5"
          >
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              {label}
            </div>
            <div className="mt-3 text-lg font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      {facilities_notes ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Notes
          </div>
          <div className="mt-3 text-white/80">{facilities_notes}</div>
        </div>
      ) : null}
    </section>
  );
}


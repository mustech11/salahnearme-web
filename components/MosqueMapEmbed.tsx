type Props = {
  name?: string | null;
  address?: string | null;
  area?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsUrl?: string | null;
  appleMapsUrl?: string | null;
};

function buildQuery(params: Props) {
  return [
    params.name,
    params.address,
    params.area,
    params.city,
    params.postcode,
    params.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function buildEmbedSrc(params: Props) {
  if (
    typeof params.latitude === "number" &&
    typeof params.longitude === "number"
  ) {
    return `https://maps.google.com/maps?q=${params.latitude},${params.longitude}&z=16&output=embed`;
  }

  const q = buildQuery(params);
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
}

export default function MosqueMapEmbed(props: Props) {
  const embedSrc = buildEmbedSrc(props);

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-2xl font-semibold text-yellow-400">
            Location & Directions
          </div>
          <p className="mt-2 text-white/70">
            Open the mosque location in your preferred maps app.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {props.googleMapsUrl ? (
            <a
              href={props.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
            >
              Google Maps
            </a>
          ) : null}

          {props.appleMapsUrl ? (
            <a
              href={props.appleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              Apple Maps
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        <iframe
          title="Mosque location map"
          src={embedSrc}
          className="h-[380px] w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </section>
  );
}


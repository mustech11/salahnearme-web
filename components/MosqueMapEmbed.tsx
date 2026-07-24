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

const MAX_QUERY_LENGTH = 500;
const MAX_URL_LENGTH = 1_000;

function cleanString(
  value: string | null | undefined
): string {
  return value
    ?.replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim() ?? "";
}

function isValidLatitude(
  value: number | null | undefined
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  );
}

function isValidLongitude(
  value: number | null | undefined
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );
}

function buildQuery(params: Props): string {
  return [
    params.name,
    params.address,
    params.area,
    params.city,
    params.postcode,
    params.country,
  ]
    .map(cleanString)
    .filter(Boolean)
    .join(", ")
    .slice(0, MAX_QUERY_LENGTH);
}

function normaliseExternalUrl(
  value: string | null | undefined
): string | null {
  const raw = cleanString(value).slice(
    0,
    MAX_URL_LENGTH
  );

  if (!raw) {
    return null;
  }

  const candidate =
    raw.startsWith("http://") ||
    raw.startsWith("https://")
      ? raw
      : `https://${raw}`;

  try {
    const url = new URL(candidate);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function buildGoogleMapsUrl(
  params: Props
): string | null {
  const supplied = normaliseExternalUrl(
    params.googleMapsUrl
  );

  if (supplied) {
    return supplied;
  }

  if (
    isValidLatitude(params.latitude) &&
    isValidLongitude(params.longitude)
  ) {
    const query = `${params.latitude},${params.longitude}`;

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      query
    )}`;
  }

  const query = buildQuery(params);

  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        query
      )}`
    : null;
}

function buildAppleMapsUrl(
  params: Props
): string | null {
  const supplied = normaliseExternalUrl(
    params.appleMapsUrl
  );

  if (supplied) {
    return supplied;
  }

  if (
    isValidLatitude(params.latitude) &&
    isValidLongitude(params.longitude)
  ) {
    return `https://maps.apple.com/?ll=${encodeURIComponent(
      `${params.latitude},${params.longitude}`
    )}&q=${encodeURIComponent(
      cleanString(params.name) || "Mosque"
    )}`;
  }

  const query = buildQuery(params);

  return query
    ? `https://maps.apple.com/?q=${encodeURIComponent(
        query
      )}`
    : null;
}

function buildEmbedSrc(
  params: Props
): string | null {
  if (
    isValidLatitude(params.latitude) &&
    isValidLongitude(params.longitude)
  ) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(
      `${params.latitude},${params.longitude}`
    )}&z=16&output=embed`;
  }

  const query = buildQuery(params);

  if (!query) {
    return null;
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(
    query
  )}&z=16&output=embed`;
}

export default function MosqueMapEmbed(
  props: Props
) {
  const embedSrc = buildEmbedSrc(props);
  const googleMapsUrl =
    buildGoogleMapsUrl(props);
  const appleMapsUrl =
    buildAppleMapsUrl(props);

  const locationText = [
    props.address,
    props.area,
    props.city,
    props.postcode,
    props.country,
  ]
    .map(cleanString)
    .filter(Boolean)
    .join(" • ");

  const mapTitle = cleanString(props.name)
    ? `${cleanString(props.name)} location map`
    : "Mosque location map";

  if (
    !embedSrc &&
    !googleMapsUrl &&
    !appleMapsUrl
  ) {
    return (
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-400">
          Location
        </div>

        <h2 className="mt-2 text-2xl font-black text-white">
          Location unavailable
        </h2>

        <p className="mt-3 max-w-3xl leading-7 text-white/60">
          A verified address or map location has not
          yet been added for this mosque.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="mosque-location-heading"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-400">
            Mosque location
          </div>

          <h2
            id="mosque-location-heading"
            className="mt-2 text-2xl font-black text-white"
          >
            Location &amp; directions
          </h2>

          <p className="mt-2 max-w-2xl leading-7 text-white/65">
            View the mosque location below or open
            directions in your preferred maps app.
          </p>

          {locationText ? (
            <address className="mt-3 not-italic text-sm leading-6 text-white/50">
              {locationText}
            </address>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          {googleMapsUrl ? (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-yellow-500 px-4 py-3 text-sm font-black text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
            >
              Google Maps
              <span
                aria-hidden="true"
                className="ml-2"
              >
                ↗
              </span>
            </a>
          ) : null}

          {appleMapsUrl ? (
            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-black text-yellow-400 transition hover:bg-yellow-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
            >
              Apple Maps
              <span
                aria-hidden="true"
                className="ml-2"
              >
                ↗
              </span>
            </a>
          ) : null}
        </div>
      </div>

      {embedSrc ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          <iframe
            title={mapTitle}
            src={embedSrc}
            className="h-[320px] w-full md:h-[420px]"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-white/55">
          The embedded map is unavailable, but you can
          still open the mosque in your preferred maps
          application.
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-white/40">
        Map positions may be approximate. Check the
        displayed address before travelling.
      </p>
    </section>
  );
}
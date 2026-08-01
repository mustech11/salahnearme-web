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

type IconName =
  | "apple"
  | "arrow"
  | "check"
  | "location"
  | "map"
  | "pin"
  | "route"
  | "warning";

const MAX_QUERY_LENGTH = 500;
const MAX_URL_LENGTH = 1_000;
const DEFAULT_ZOOM = 16;

function cleanString(
  value: string | null | undefined,
  maxLength = MAX_QUERY_LENGTH
): string {
  return (
    value
      ?.replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength) ?? ""
  );
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

function hasValidCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  return (
    isValidLatitude(latitude) &&
    isValidLongitude(longitude)
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
    .map((value) =>
      cleanString(value, MAX_QUERY_LENGTH)
    )
    .filter(Boolean)
    .join(", ")
    .slice(0, MAX_QUERY_LENGTH);
}

function normaliseExternalUrl(
  value: string | null | undefined
): string | null {
  const raw = cleanString(
    value,
    MAX_URL_LENGTH
  );

  if (!raw) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(raw)
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
    hasValidCoordinates(
      params.latitude,
      params.longitude
    )
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

  const label =
    cleanString(params.name, 180) || "Mosque";

  if (
    hasValidCoordinates(
      params.latitude,
      params.longitude
    )
  ) {
    return `https://maps.apple.com/?ll=${encodeURIComponent(
      `${params.latitude},${params.longitude}`
    )}&q=${encodeURIComponent(label)}`;
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
    hasValidCoordinates(
      params.latitude,
      params.longitude
    )
  ) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(
      `${params.latitude},${params.longitude}`
    )}&z=${DEFAULT_ZOOM}&output=embed`;
  }

  const query = buildQuery(params);

  return query
    ? `https://maps.google.com/maps?q=${encodeURIComponent(
        query
      )}&z=${DEFAULT_ZOOM}&output=embed`
    : null;
}

function buildLocationText(
  params: Props
): string {
  return [
    params.address,
    params.area,
    params.city,
    params.postcode,
    params.country,
  ]
    .map((value) => cleanString(value, 250))
    .filter(Boolean)
    .join(" • ");
}

export default function MosqueMapEmbed(
  props: Props
) {
  const embedSrc = buildEmbedSrc(props);
  const googleMapsUrl =
    buildGoogleMapsUrl(props);
  const appleMapsUrl =
    buildAppleMapsUrl(props);

  const locationText =
    buildLocationText(props);

  const mosqueName =
    cleanString(props.name, 180) || "Mosque";

  const mapTitle = `${mosqueName} location map`;

  const coordinatesAvailable =
    hasValidCoordinates(
      props.latitude,
      props.longitude
    );

  if (
    !embedSrc &&
    !googleMapsUrl &&
    !appleMapsUrl
  ) {
    return (
      <section
        aria-labelledby="mosque-location-unavailable-heading"
        className="luxe-card relative overflow-hidden rounded-[2rem] border border-yellow-500/20 p-6 sm:p-8"
      >
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-16 h-40 w-40 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
        />

        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.08] text-yellow-300">
            <Icon
              name="warning"
              className="h-6 w-6"
            />
          </span>

          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
              Mosque location
            </div>

            <h2
              id="mosque-location-unavailable-heading"
              className="mt-2 text-2xl font-black text-white"
            >
              Location unavailable
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60 sm:text-base">
              A verified address or map position has
              not yet been added for this mosque.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="mosque-location-heading"
      className="luxe-card relative isolate overflow-hidden rounded-[2rem] border border-yellow-500/20 p-6 sm:p-8"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.10),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.05),transparent_28%)]"
      />

      <div className="flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
            <Icon
              name="location"
              className="h-4 w-4"
            />
            Mosque location
          </div>

          <h2
            id="mosque-location-heading"
            className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl"
          >
            Location &amp; directions
          </h2>

          <p className="mt-3 text-sm leading-7 text-white/60 sm:text-base">
            View {mosqueName} on the map or open
            turn-by-turn directions in your preferred
            maps application.
          </p>

          {locationText ? (
            <address
              dir="auto"
              className="mt-4 flex max-w-2xl items-start gap-2 not-italic text-sm leading-6 text-white/55"
            >
              <Icon
                name="pin"
                className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300"
              />
              <span>{locationText}</span>
            </address>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          {googleMapsUrl ? (
            <MapActionLink
              href={googleMapsUrl}
              label="Google Maps"
              icon="map"
              primary
            />
          ) : null}

          {appleMapsUrl ? (
            <MapActionLink
              href={appleMapsUrl}
              label="Apple Maps"
              icon="apple"
            />
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30 shadow-2xl">
          {embedSrc ? (
            <iframe
              title={mapTitle}
              src={embedSrc}
              className="h-[320px] w-full md:h-[440px]"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex min-h-[320px] items-center justify-center p-6 text-center text-sm leading-7 text-white/55 md:min-h-[440px]">
              The embedded map is unavailable, but
              directions can still be opened using
              the map buttons above.
            </div>
          )}
        </div>

        <aside className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
            Travel check
          </div>

          <div className="mt-4 space-y-4">
            <InfoRow
              icon="check"
              title="Map reference"
              description={
                coordinatesAvailable
                  ? "Exact coordinates are available for this profile."
                  : "The map uses the published address and location text."
              }
            />

            <InfoRow
              icon="route"
              title="Before travelling"
              description="Check the displayed address and allow extra time for Jumu’ah or busy prayer periods."
            />

            <InfoRow
              icon="warning"
              title="Community accuracy"
              description="Map positions can be approximate and are not a substitute for official mosque directions."
            />
          </div>
        </aside>
      </div>

      <p className="mt-4 text-xs leading-5 text-white/35">
        Map positions may be approximate. Confirm the
        displayed address before travelling.
      </p>
    </section>
  );
}

function MapActionLink({
  href,
  label,
  icon,
  primary = false,
}: {
  href: string;
  label: string;
  icon: IconName;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className={
        primary
          ? "luxe-button inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm"
          : "luxe-button-outline inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm"
      }
    >
      <Icon
        name={icon}
        className="mr-2 h-4 w-4"
      />
      {label}
      <Icon
        name="arrow"
        className="ml-2 h-4 w-4"
      />
    </a>
  );
}

function InfoRow({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/[0.08] text-yellow-300">
        <Icon
          name={icon}
          className="h-4 w-4"
        />
      </span>

      <div>
        <div className="text-sm font-black text-white">
          {title}
        </div>

        <p className="mt-1 text-xs leading-5 text-white/45">
          {description}
        </p>
      </div>
    </div>
  );
}

function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  if (name === "apple") {
    return (
      <svg {...common}>
        <path d="M12 6c1.4-1.8 3.2-2 4-2-.1 1.5-.9 3-2.2 3.8C13 8.3 12.1 8.4 12 8.4" />
        <path d="M17.8 13.2c0-2 1.7-3 1.8-3.1-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.7-3.1.7-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.8 2.1 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1 2.7-2.1.8-1.2 1.2-2.4 1.2-2.5-.1 0-3-.9-3-3.5Z" />
      </svg>
    );
  }

  if (name === "arrow") {
    return (
      <svg {...common}>
        <path d="M7 17 17 7" />
        <path d="M7 7h10v10" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (name === "location" || name === "pin") {
    return (
      <svg {...common}>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }

  if (name === "map") {
    return (
      <svg {...common}>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
        <path d="M9 3v15M15 6v15" />
      </svg>
    );
  }

  if (name === "route") {
    return (
      <svg {...common}>
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="5" r="2" />
        <path d="M8 19h3a4 4 0 0 0 4-4v-1a4 4 0 0 0-4-4H9a3 3 0 0 1-3-3V7" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
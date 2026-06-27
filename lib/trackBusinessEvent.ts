export type BusinessEventType =
  | "profile_view"
  | "profile_click"
  | "phone_click"
  | "website_click"
  | "maps_click"
  | "sponsor_impression"
  | "sponsor_click";

type TrackBusinessEventArgs = {
  businessId: string;
  eventType: BusinessEventType;
  source?: string;
  pageType?: string;
  citySlug?: string | null;
  metadata?: Record<string, unknown>;
};

function getFingerprint() {
  if (typeof window === "undefined") {
    return "server";
  }

  try {
    const existing = window.localStorage.getItem("snm_fp");

    if (existing) {
      return existing;
    }

    const value =
      globalThis.crypto?.randomUUID?.() ||
      `fp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    window.localStorage.setItem("snm_fp", value);

    return value;
  } catch {
    return `fp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

export async function trackBusinessEvent({
  businessId,
  eventType,
  source = "public_business_page",
  pageType,
  citySlug,
  metadata,
}: TrackBusinessEventArgs) {
  if (!businessId || !eventType) {
    return;
  }

  const userFingerprint = getFingerprint();
  const safeCitySlug = citySlug ?? undefined;

  try {
    await fetch("/api/business/track-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify({
        business_id: businessId,
        event_type: eventType,
        source,
        metadata: {
          ...(metadata ?? {}),
          page_type: pageType,
          city_slug: safeCitySlug,
          user_fingerprint: userFingerprint,
          pathname:
            typeof window !== "undefined" ? window.location.pathname : null,
          referrer:
            typeof document !== "undefined"
              ? document.referrer || null
              : null,
        },
      }),
    });
  } catch {
    // Analytics must never break the public page.
  }
}


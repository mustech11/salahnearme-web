"use client";

import { useEffect, useMemo, useRef } from "react";

import { trackBusinessEvent } from "@/lib/trackBusinessEvent";

type Props = {
  businessId: string;
  source?: string;
  pageType?: string;
  citySlug?: string | null;
  metadata?: Record<string, unknown>;
};

export default function BusinessAnalyticsTracker({
  businessId,
  source = "business_page",
  pageType = "business_profile",
  citySlug,
  metadata,
}: Props) {
  const trackedRef = useRef(false);

  const safeCitySlug = citySlug ?? undefined;

  const stableMetadata = useMemo(() => {
    return metadata ?? {};
  }, [metadata]);

  useEffect(() => {
    if (!businessId || trackedRef.current) {
      return;
    }

    trackedRef.current = true;

    trackBusinessEvent({
      businessId,
      eventType: "profile_view",
      source,
      pageType,
      citySlug: safeCitySlug,
      metadata: {
        pathname:
          typeof window !== "undefined" ? window.location.pathname : null,
        referrer:
          typeof document !== "undefined"
            ? document.referrer || null
            : null,
        ...stableMetadata,
      },
    });
  }, [businessId, source, pageType, safeCitySlug, stableMetadata]);

  return null;
}


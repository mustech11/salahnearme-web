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

export default function BusinessSponsorImpressionTracker({
  businessId,
  source = "sponsor_impression",
  pageType = "mosque_page",
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
      eventType: "sponsor_impression",
      source,
      pageType,
      citySlug: safeCitySlug,
      metadata: stableMetadata,
    });
  }, [businessId, source, pageType, safeCitySlug, stableMetadata]);

  return null;
}


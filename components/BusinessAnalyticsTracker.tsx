"use client";

import {
  useEffect,
  useMemo,
  useRef,
} from "react";

import { trackBusinessEvent } from "@/lib/trackBusinessEvent";

type Props = {
  businessId: string;
  source?: string;
  pageType?: string;
  citySlug?: string | null;
  metadata?: Record<string, unknown>;
};

function cleanText(
  value: string | null | undefined,
  maxLength = 300
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

  return cleaned || undefined;
}

function serialiseMetadata(
  metadata: Record<string, unknown> | undefined
): string {
  if (!metadata) {
    return "{}";
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return "{}";
  }
}

export default function BusinessAnalyticsTracker({
  businessId,
  source = "business_page",
  pageType = "business_profile",
  citySlug,
  metadata,
}: Props) {
  const trackedKeyRef = useRef<string | null>(null);

  const cleanBusinessId = useMemo(
    () => cleanText(businessId, 80),
    [businessId]
  );

  const cleanSource = useMemo(
    () => cleanText(source, 120) ?? "business_page",
    [source]
  );

  const cleanPageType = useMemo(
    () =>
      cleanText(pageType, 120) ??
      "business_profile",
    [pageType]
  );

  const cleanCitySlug = useMemo(
    () => cleanText(citySlug, 200),
    [citySlug]
  );

  const metadataKey = useMemo(
    () => serialiseMetadata(metadata),
    [metadata]
  );

  const trackingKey = useMemo(
    () =>
      [
        cleanBusinessId ?? "",
        cleanSource,
        cleanPageType,
        cleanCitySlug ?? "",
        metadataKey,
      ].join("|"),
    [
      cleanBusinessId,
      cleanCitySlug,
      cleanPageType,
      cleanSource,
      metadataKey,
    ]
  );

  useEffect(() => {
    if (
      !cleanBusinessId ||
      trackedKeyRef.current === trackingKey
    ) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const trackView = () => {
      if (
        cancelled ||
        trackedKeyRef.current === trackingKey
      ) {
        return;
      }

      trackedKeyRef.current = trackingKey;

      void trackBusinessEvent({
        businessId: cleanBusinessId,
        eventType: "profile_view",
        source: cleanSource,
        pageType: cleanPageType,
        citySlug: cleanCitySlug,
        metadata,
      });
    };

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        trackView();
      }
    }

    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    } else {
      timeoutId = window.setTimeout(trackView, 150);
    }

    return () => {
      cancelled = true;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [
    cleanBusinessId,
    cleanCitySlug,
    cleanPageType,
    cleanSource,
    metadata,
    trackingKey,
  ]);

  return null;
}
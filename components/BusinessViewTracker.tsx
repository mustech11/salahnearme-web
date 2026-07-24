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
  slug?: string | null;
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

export default function BusinessViewTracker({
  businessId,
  source = "business_profile",
  pageType = "business_page",
  citySlug,
  slug,
  metadata,
}: Props) {
  const trackedKeyRef = useRef<string | null>(null);

  const cleanBusinessId = useMemo(
    () => cleanText(businessId, 80),
    [businessId]
  );

  const cleanCitySlug = useMemo(
    () => cleanText(citySlug, 200),
    [citySlug]
  );

  const cleanSlug = useMemo(
    () => cleanText(slug, 250),
    [slug]
  );

  const trackingKey = useMemo(
    () =>
      [
        cleanBusinessId ?? "",
        source,
        pageType,
        cleanCitySlug ?? "",
        cleanSlug ?? "",
      ].join("|"),
    [
      cleanBusinessId,
      cleanCitySlug,
      cleanSlug,
      pageType,
      source,
    ]
  );

  useEffect(() => {
    if (
      !cleanBusinessId ||
      trackedKeyRef.current === trackingKey
    ) {
      return;
    }

    trackedKeyRef.current = trackingKey;

    void trackBusinessEvent({
      businessId: cleanBusinessId,
      eventType: "profile_view",
      source,
      pageType,
      citySlug: cleanCitySlug,
      metadata: {
        slug: cleanSlug ?? null,
        ...metadata,
      },
    });
  }, [
    cleanBusinessId,
    cleanCitySlug,
    cleanSlug,
    metadata,
    pageType,
    source,
    trackingKey,
  ]);

  return null;
}
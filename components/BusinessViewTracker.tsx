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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TRACK_DELAY_MS = 150;

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

function safeMetadataKey(
  metadata: Record<string, unknown> | undefined
): string {
  if (!metadata) {
    return "{}";
  }

  try {
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(metadata)
          .slice(0, 50)
          .sort(([first], [second]) =>
            first.localeCompare(second)
          )
      )
    );
  } catch {
    return "{}";
  }
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

  const cleanSource = useMemo(
    () =>
      cleanText(source, 120) ??
      "business_profile",
    [source]
  );

  const cleanPageType = useMemo(
    () =>
      cleanText(pageType, 120) ??
      "business_page",
    [pageType]
  );

  const cleanCitySlug = useMemo(
    () => cleanText(citySlug, 200),
    [citySlug]
  );

  const cleanSlug = useMemo(
    () => cleanText(slug, 250),
    [slug]
  );

  const metadataKey = useMemo(
    () => safeMetadataKey(metadata),
    [metadata]
  );

  const trackingKey = useMemo(
    () =>
      [
        cleanBusinessId ?? "",
        cleanSource,
        cleanPageType,
        cleanCitySlug ?? "",
        cleanSlug ?? "",
        metadataKey,
      ].join("|"),
    [
      cleanBusinessId,
      cleanCitySlug,
      cleanPageType,
      cleanSlug,
      cleanSource,
      metadataKey,
    ]
  );

  useEffect(() => {
    if (
      !cleanBusinessId ||
      !UUID_REGEX.test(cleanBusinessId) ||
      trackedKeyRef.current === trackingKey
    ) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const recordView = () => {
      if (
        cancelled ||
        trackedKeyRef.current === trackingKey
      ) {
        return;
      }

      trackedKeyRef.current = trackingKey;

      try {
        const result = trackBusinessEvent({
          businessId: cleanBusinessId,
          eventType: "profile_view",
          source: cleanSource,
          pageType: cleanPageType,
          citySlug: cleanCitySlug,
          metadata: {
            slug: cleanSlug ?? null,
            path: window.location.pathname,
            referrer: document.referrer.slice(
              0,
              1_000
            ),
            ...metadata,
          },
        });

        void Promise.resolve(result).catch(
          (error: unknown) => {
            console.error(
              "Business view tracking failed:",
              error
            );
          }
        );
      } catch (error) {
        console.error(
          "Business view tracking failed:",
          error
        );
      }
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible"
      ) {
        recordView();
      }
    };

    if (
      document.visibilityState === "hidden"
    ) {
      document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    } else {
      timeoutId = window.setTimeout(
        recordView,
        TRACK_DELAY_MS
      );
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
    cleanSlug,
    cleanSource,
    metadata,
    trackingKey,
  ]);

  return null;
}
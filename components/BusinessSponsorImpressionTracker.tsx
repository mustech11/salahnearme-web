"use client";

import { useEffect, useMemo, useRef } from "react";

import { trackBusinessEvent } from "@/lib/trackBusinessEvent";

type MetadataValue =
  | string
  | number
  | boolean
  | null
  | MetadataValue[]
  | {
      [key: string]: MetadataValue;
    };

type Props = {
  businessId: string;
  source?: string;
  pageType?: string;
  citySlug?: string | null;
  metadata?: Record<string, unknown>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_SOURCE = "sponsor_impression";
const DEFAULT_PAGE_TYPE = "mosque_page";

const MAX_TEXT_LENGTH = 300;
const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_KEYS = 50;
const MAX_METADATA_ARRAY_ITEMS = 50;

function cleanString(
  value: string | null | undefined,
  maxLength = MAX_TEXT_LENGTH
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, maxLength);

  return cleaned || undefined;
}

function sanitiseMetadataValue(
  value: unknown,
  depth = 0
): MetadataValue | undefined {
  if (depth > MAX_METADATA_DEPTH) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      return undefined;
    }

    return value;
  }

  if (typeof value === "string") {
    return cleanString(value, 1000) ?? "";
  }

  if (Array.isArray(value)) {
    const values = value
      .slice(0, MAX_METADATA_ARRAY_ITEMS)
      .map((item) => sanitiseMetadataValue(item, depth + 1))
      .filter(
        (item): item is MetadataValue =>
          item !== undefined
      );

    return values;
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const entries = Object.entries(
      value as Record<string, unknown>
    ).slice(0, MAX_METADATA_KEYS);

    const result: Record<string, MetadataValue> = {};

    for (const [rawKey, rawValue] of entries) {
      const key = cleanString(rawKey, 100);

      if (!key) {
        continue;
      }

      const sanitisedValue = sanitiseMetadataValue(
        rawValue,
        depth + 1
      );

      if (sanitisedValue !== undefined) {
        result[key] = sanitisedValue;
      }
    }

    return result;
  }

  return undefined;
}

function sanitiseMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, MetadataValue> {
  if (!metadata) {
    return {};
  }

  const sanitised = sanitiseMetadataValue(metadata);

  if (
    sanitised &&
    typeof sanitised === "object" &&
    !Array.isArray(sanitised)
  ) {
    return sanitised;
  }

  return {};
}

function stableSerialise(
  value: Record<string, MetadataValue>
): string {
  try {
    const sortedEntries = Object.entries(value).sort(
      ([firstKey], [secondKey]) =>
        firstKey.localeCompare(secondKey)
    );

    return JSON.stringify(
      Object.fromEntries(sortedEntries)
    );
  } catch {
    return "{}";
  }
}

export default function BusinessSponsorImpressionTracker({
  businessId,
  source = DEFAULT_SOURCE,
  pageType = DEFAULT_PAGE_TYPE,
  citySlug,
  metadata,
}: Props) {
  const trackedKeyRef = useRef<string | null>(null);

  const cleanBusinessId = useMemo(
    () => cleanString(businessId, 80),
    [businessId]
  );

  const cleanSource = useMemo(
    () =>
      cleanString(source, 120) ??
      DEFAULT_SOURCE,
    [source]
  );

  const cleanPageType = useMemo(
    () =>
      cleanString(pageType, 120) ??
      DEFAULT_PAGE_TYPE,
    [pageType]
  );

  const cleanCitySlug = useMemo(
    () => cleanString(citySlug, 160),
    [citySlug]
  );

  const safeMetadata = useMemo(
    () => sanitiseMetadata(metadata),
    [metadata]
  );

  const serialisedMetadata = useMemo(
    () => stableSerialise(safeMetadata),
    [safeMetadata]
  );

  const trackingKey = useMemo(
    () =>
      [
        cleanBusinessId ?? "",
        cleanSource,
        cleanPageType,
        cleanCitySlug ?? "",
        serialisedMetadata,
      ].join("|"),
    [
      cleanBusinessId,
      cleanSource,
      cleanPageType,
      cleanCitySlug,
      serialisedMetadata,
    ]
  );

  useEffect(() => {
    if (
      !cleanBusinessId ||
      !UUID_REGEX.test(cleanBusinessId)
    ) {
      return;
    }

    if (trackedKeyRef.current === trackingKey) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const recordImpression = () => {
      if (
        cancelled ||
        trackedKeyRef.current === trackingKey
      ) {
        return;
      }

      trackedKeyRef.current = trackingKey;

      const runtimeMetadata: Record<
        string,
        MetadataValue
      > = {
        ...safeMetadata,
      };

      if (typeof window !== "undefined") {
        runtimeMetadata.path =
          window.location.pathname;

        runtimeMetadata.url =
          window.location.href.slice(0, 1000);

        runtimeMetadata.referrer =
          document.referrer.slice(0, 1000);

        runtimeMetadata.viewport_width =
          window.innerWidth;

        runtimeMetadata.viewport_height =
          window.innerHeight;

        runtimeMetadata.visibility_state =
          document.visibilityState;
      }

      try {
        const result = trackBusinessEvent({
          businessId: cleanBusinessId,
          eventType: "sponsor_impression",
          source: cleanSource,
          pageType: cleanPageType,
          citySlug: cleanCitySlug,
          metadata: runtimeMetadata,
        });

        void Promise.resolve(result).catch(
          (error: unknown) => {
            console.error(
              "Sponsor impression tracking failed:",
              error
            );
          }
        );
      } catch (error) {
        console.error(
          "Sponsor impression tracking failed:",
          error
        );
      }
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible"
      ) {
        recordImpression();
      }
    };

    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    } else {
      timeoutId = window.setTimeout(
        recordImpression,
        250
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
    cleanSource,
    safeMetadata,
    trackingKey,
  ]);

  return null;
}
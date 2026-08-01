"use client";

import {
  useEffect,
  useMemo,
  useRef,
} from "react";

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
  threshold?: number;
  minimumVisibleMs?: number;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_SOURCE = "sponsor_impression";
const DEFAULT_PAGE_TYPE = "mosque_page";
const DEFAULT_THRESHOLD = 0.5;
const DEFAULT_MINIMUM_VISIBLE_MS = 750;

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

  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

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
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : undefined;
  }

  if (typeof value === "string") {
    return cleanString(value, 1_000) ?? "";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_METADATA_ARRAY_ITEMS)
      .map((item) =>
        sanitiseMetadataValue(item, depth + 1)
      )
      .filter(
        (item): item is MetadataValue =>
          item !== undefined
      );
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const result: Record<string, MetadataValue> = {};

    for (const [rawKey, rawValue] of Object.entries(
      value as Record<string, unknown>
    ).slice(0, MAX_METADATA_KEYS)) {
      const key = cleanString(rawKey, 100);

      if (!key) {
        continue;
      }

      const sanitisedValue =
        sanitiseMetadataValue(
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
  const sanitised =
    sanitiseMetadataValue(metadata);

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
  value: MetadataValue
): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialise).join(",")}]`;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return `{${Object.entries(value)
      .sort(([first], [second]) =>
        first.localeCompare(second)
      )
      .map(
        ([key, nestedValue]) =>
          `${JSON.stringify(key)}:${stableSerialise(
            nestedValue
          )}`
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function normaliseThreshold(
  value: number | undefined
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_THRESHOLD;
  }

  return Math.min(1, Math.max(0, value));
}

function normaliseVisibleMs(
  value: number | undefined
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_MINIMUM_VISIBLE_MS;
  }

  return Math.min(
    10_000,
    Math.max(0, Math.trunc(value))
  );
}

export default function BusinessSponsorImpressionTracker({
  businessId,
  source = DEFAULT_SOURCE,
  pageType = DEFAULT_PAGE_TYPE,
  citySlug,
  metadata,
  threshold = DEFAULT_THRESHOLD,
  minimumVisibleMs = DEFAULT_MINIMUM_VISIBLE_MS,
}: Props) {
  const markerRef =
    useRef<HTMLSpanElement | null>(null);

  const trackedKeyRef =
    useRef<string | null>(null);

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

  const safeThreshold = useMemo(
    () => normaliseThreshold(threshold),
    [threshold]
  );

  const safeMinimumVisibleMs = useMemo(
    () =>
      normaliseVisibleMs(minimumVisibleMs),
    [minimumVisibleMs]
  );

  const trackingKey = useMemo(
    () =>
      [
        cleanBusinessId ?? "",
        cleanSource,
        cleanPageType,
        cleanCitySlug ?? "",
        stableSerialise(safeMetadata),
      ].join("|"),
    [
      cleanBusinessId,
      cleanCitySlug,
      cleanPageType,
      cleanSource,
      safeMetadata,
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

    const marker = markerRef.current;

    if (!marker) {
      return;
    }

    let cancelled = false;
    let visibleTimerId: number | null = null;

    const clearVisibleTimer = () => {
      if (visibleTimerId !== null) {
        window.clearTimeout(visibleTimerId);
        visibleTimerId = null;
      }
    };

    const recordImpression = () => {
      if (
        cancelled ||
        trackedKeyRef.current === trackingKey ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      trackedKeyRef.current = trackingKey;

      const runtimeMetadata: Record<
        string,
        MetadataValue
      > = {
        ...safeMetadata,
        path: window.location.pathname,
        url: window.location.href.slice(0, 1_000),
        referrer: document.referrer.slice(0, 1_000),
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        visibility_state:
          document.visibilityState,
        visibility_threshold:
          safeThreshold,
        minimum_visible_ms:
          safeMinimumVisibleMs,
      };

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

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (
          !entry ||
          !entry.isIntersecting ||
          entry.intersectionRatio < safeThreshold ||
          document.visibilityState !== "visible"
        ) {
          clearVisibleTimer();
          return;
        }

        if (visibleTimerId !== null) {
          return;
        }

        visibleTimerId = window.setTimeout(
          recordImpression,
          safeMinimumVisibleMs
        );
      },
      {
        threshold: [
          0,
          safeThreshold,
          1,
        ],
      }
    );

    observer.observe(marker);

    const handleVisibilityChange = () => {
      if (
        document.visibilityState !== "visible"
      ) {
        clearVisibleTimer();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      cancelled = true;
      clearVisibleTimer();
      observer.disconnect();

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
    safeMinimumVisibleMs,
    safeThreshold,
    trackingKey,
  ]);

  return (
    <span
      ref={markerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    />
  );
}
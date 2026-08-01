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

type MetadataValue =
  | string
  | number
  | boolean
  | null
  | MetadataValue[]
  | { [key: string]: MetadataValue };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_SOURCE = "business_page";
const DEFAULT_PAGE_TYPE = "business_profile";
const TRACK_DELAY_MS = 150;
const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_KEYS = 50;
const MAX_METADATA_ARRAY_ITEMS = 50;

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
    return cleanText(value, 1_000) ?? "";
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
      const key = cleanText(rawKey, 100);

      if (!key) {
        continue;
      }

      const sanitised = sanitiseMetadataValue(
        rawValue,
        depth + 1
      );

      if (sanitised !== undefined) {
        result[key] = sanitised;
      }
    }

    return result;
  }

  return undefined;
}

function sanitiseMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, MetadataValue> {
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

function stableSerialise(value: MetadataValue): string {
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

export default function BusinessAnalyticsTracker({
  businessId,
  source = DEFAULT_SOURCE,
  pageType = DEFAULT_PAGE_TYPE,
  citySlug,
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
      DEFAULT_SOURCE,
    [source]
  );

  const cleanPageType = useMemo(
    () =>
      cleanText(pageType, 120) ??
      DEFAULT_PAGE_TYPE,
    [pageType]
  );

  const cleanCitySlug = useMemo(
    () => cleanText(citySlug, 200),
    [citySlug]
  );

  const safeMetadata = useMemo(
    () => sanitiseMetadata(metadata),
    [metadata]
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

      const runtimeMetadata: Record<
        string,
        MetadataValue
      > = {
        ...safeMetadata,
        path: window.location.pathname.slice(
          0,
          1_000
        ),
        referrer: document.referrer.slice(
          0,
          1_000
        ),
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        visibility_state:
          document.visibilityState,
      };

      try {
        const result = trackBusinessEvent({
          businessId: cleanBusinessId,
          eventType: "profile_view",
          source: cleanSource,
          pageType: cleanPageType,
          citySlug: cleanCitySlug,
          metadata: runtimeMetadata,
        });

        void Promise.resolve(result).catch(
          (error: unknown) => {
            console.error(
              "Business profile-view tracking failed:",
              error
            );
          }
        );
      } catch (error) {
        console.error(
          "Business profile-view tracking failed:",
          error
        );
      }
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible"
      ) {
        trackView();
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
        trackView,
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
    cleanSource,
    safeMetadata,
    trackingKey,
  ]);

  return null;
}
"use client";

import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";
import {
  useEffect,
  useMemo,
  useRef,
} from "react";

import {
  trackBusinessEvent,
  type BusinessEventType,
} from "@/lib/trackBusinessEvent";

type SharedTrackingProps = {
  businessId: string;
  eventType: BusinessEventType;
  source?: string;
  pageType?: string;
  citySlug?: string | null;
  metadata?: Record<string, unknown>;
};

type ProfileViewProps = {
  businessId: string;
  slug?: string | null;
  source?: string;
  pageType?: string;
  citySlug?: string | null;
  metadata?: Record<string, unknown>;
};

type AnchorProps = SharedTrackingProps & {
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
} & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  | "href"
  | "children"
  | "className"
  | "onClick"
  | "aria-label"
>;

type LinkProps = SharedTrackingProps & {
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  prefetch?: boolean;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROFILE_VIEW_DELAY_MS = 150;

function cleanText(
  value: string | null | undefined,
  maxLength = 500
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

function getChildrenLabel(
  children: ReactNode
): string | undefined {
  if (
    typeof children === "string" ||
    typeof children === "number"
  ) {
    return cleanText(String(children), 200);
  }

  return undefined;
}

function getSafeRel(
  target: string | undefined,
  rel: string | undefined
): string | undefined {
  if (target !== "_blank") {
    return rel;
  }

  const values = new Set(
    (rel ?? "")
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean)
  );

  values.add("noopener");
  values.add("noreferrer");

  return Array.from(values).join(" ");
}

function isSafeHref(href: string): boolean {
  if (
    href.startsWith("/") ||
    href.startsWith("#") ||
    href.startsWith("?") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return true;
  }

  try {
    const url = new URL(href);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function trackClick({
  businessId,
  eventType,
  source,
  pageType,
  citySlug,
  metadata,
  href,
  label,
  event,
  target,
}: SharedTrackingProps & {
  href: string;
  label?: string;
  event: MouseEvent<HTMLAnchorElement>;
  target?: string;
}) {
  const cleanBusinessId = cleanText(
    businessId,
    80
  );

  if (
    !cleanBusinessId ||
    !UUID_REGEX.test(cleanBusinessId)
  ) {
    return;
  }

  try {
    const result = trackBusinessEvent({
      businessId: cleanBusinessId,
      eventType,
      source:
        cleanText(source, 120) ??
        "business_page",
      pageType:
        cleanText(pageType, 120) ??
        "business_page",
      citySlug: cleanText(citySlug, 200),
      metadata: {
        href: href.slice(0, 2_000),
        label: label ?? null,
        target: target ?? null,
        modified_click:
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey,
        mouse_button: event.button,
        ...metadata,
      },
    });

    void Promise.resolve(result).catch(
      (error: unknown) => {
        console.error(
          "Business click tracking failed:",
          error
        );
      }
    );
  } catch (error) {
    console.error(
      "Business click tracking failed:",
      error
    );
  }
}

export function BusinessProfileViewTracker({
  businessId,
  slug,
  source = "business_profile",
  pageType = "business_profile",
  citySlug,
  metadata,
}: ProfileViewProps) {
  const trackedKeyRef = useRef<string | null>(null);

  const cleanBusinessId = useMemo(
    () => cleanText(businessId, 80),
    [businessId]
  );

  const cleanSlug = useMemo(
    () => cleanText(slug, 250),
    [slug]
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
      "business_profile",
    [pageType]
  );

  const cleanCitySlug = useMemo(
    () => cleanText(citySlug, 200),
    [citySlug]
  );

  const trackingKey = useMemo(
    () =>
      [
        cleanBusinessId ?? "",
        cleanSlug ?? "",
        cleanSource,
        cleanPageType,
        cleanCitySlug ?? "",
      ].join("|"),
    [
      cleanBusinessId,
      cleanCitySlug,
      cleanPageType,
      cleanSlug,
      cleanSource,
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

    const record = () => {
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
            ...metadata,
          },
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
        record();
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
        record,
        PROFILE_VIEW_DELAY_MS
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

export function TrackedBusinessAnchor({
  businessId,
  eventType,
  href,
  children,
  className,
  source = "business_page",
  pageType = "business_page",
  citySlug,
  metadata,
  target,
  rel,
  ariaLabel,
  ...anchorProps
}: AnchorProps) {
  const cleanHref =
    cleanText(href, 2_000) ?? "#";

  const safeHref = isSafeHref(cleanHref)
    ? cleanHref
    : "#";

  function handleClick(
    event: MouseEvent<HTMLAnchorElement>
  ) {
    trackClick({
      businessId,
      eventType,
      source,
      pageType,
      citySlug,
      metadata,
      href: safeHref,
      label:
        cleanText(ariaLabel, 200) ??
        getChildrenLabel(children),
      event,
      target,
    });
  }

  return (
    <a
      {...anchorProps}
      href={safeHref}
      target={target}
      rel={getSafeRel(target, rel)}
      aria-label={ariaLabel}
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}

export function TrackedBusinessLink({
  businessId,
  eventType,
  href,
  children,
  className,
  source = "business_page",
  pageType = "business_page",
  citySlug,
  metadata,
  ariaLabel,
  prefetch = false,
}: LinkProps) {
  const cleanHref =
    cleanText(href, 2_000) ?? "/";

  const safeHref =
    cleanHref.startsWith("/") ||
    cleanHref.startsWith("#") ||
    cleanHref.startsWith("?")
      ? cleanHref
      : "/";

  function handleClick(
    event: MouseEvent<HTMLAnchorElement>
  ) {
    trackClick({
      businessId,
      eventType,
      source,
      pageType,
      citySlug,
      metadata,
      href: safeHref,
      label:
        cleanText(ariaLabel, 200) ??
        getChildrenLabel(children),
      event,
    });
  }

  return (
    <Link
      href={safeHref}
      prefetch={prefetch}
      aria-label={ariaLabel}
      className={className}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}
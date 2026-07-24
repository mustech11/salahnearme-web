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

export function BusinessProfileViewTracker({
  businessId,
  slug,
  source = "business_profile",
  pageType = "business_profile",
  citySlug,
  metadata,
}: ProfileViewProps) {
  const trackedKeyRef = useRef<string | null>(null);

  const trackingKey = useMemo(
    () =>
      [
        businessId.trim(),
        cleanText(slug, 250) ?? "",
        source,
        pageType,
        cleanText(citySlug, 250) ?? "",
      ].join("|"),
    [
      businessId,
      slug,
      source,
      pageType,
      citySlug,
    ]
  );

  useEffect(() => {
    if (
      !businessId.trim() ||
      trackedKeyRef.current === trackingKey
    ) {
      return;
    }

    trackedKeyRef.current = trackingKey;

    void trackBusinessEvent({
      businessId,
      eventType: "profile_view",
      source,
      pageType,
      citySlug,
      metadata: {
        slug: cleanText(slug, 250) ?? null,
        ...metadata,
      },
    });
  }, [
    businessId,
    citySlug,
    metadata,
    pageType,
    slug,
    source,
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
  function handleClick(
    event: MouseEvent<HTMLAnchorElement>
  ) {
    void trackBusinessEvent({
      businessId,
      eventType,
      source,
      pageType,
      citySlug,
      metadata: {
        href,
        label:
          cleanText(ariaLabel, 200) ??
          getChildrenLabel(children) ??
          null,
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
  }

  return (
    <a
      {...anchorProps}
      href={href}
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
  function handleClick(
    event: MouseEvent<HTMLAnchorElement>
  ) {
    void trackBusinessEvent({
      businessId,
      eventType,
      source,
      pageType,
      citySlug,
      metadata: {
        href,
        label:
          cleanText(ariaLabel, 200) ??
          getChildrenLabel(children) ??
          null,
        modified_click:
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey,
        mouse_button: event.button,
        ...metadata,
      },
    });
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-label={ariaLabel}
      className={className}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}
"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";

type BusinessEventType =
  | "profile_view"
  | "profile_click"
  | "phone_click"
  | "website_click"
  | "maps_click"
  | "sponsor_impression"
  | "sponsor_click";

type TrackOptions = {
  businessId: string;
  eventType: BusinessEventType;
  source?: string;
  metadata?: Record<string, unknown>;
};

const TRACK_EVENT_URL = "/api/business/track-event";

async function trackBusinessEvent({
  businessId,
  eventType,
  source = "business_page",
  metadata = {},
}: TrackOptions) {
  if (!businessId || !eventType) {
    return;
  }

  const payload = {
    business_id: businessId,
    event_type: eventType,
    source,
    metadata,
  };

  try {
    /**
     * navigator.sendBeacon is better for tracking clicks that navigate away
     * because it can still send the request while the page is unloading.
     */
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });

      const sent = navigator.sendBeacon(TRACK_EVENT_URL, blob);

      if (sent) {
        return;
      }
    }

    await fetch(TRACK_EVENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (error) {
    console.error("Failed to track business event:", error);
  }
}

export function BusinessProfileViewTracker({
  businessId,
  slug,
}: {
  businessId: string;
  slug?: string | null;
}) {
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (!businessId || hasTrackedRef.current) {
      return;
    }

    hasTrackedRef.current = true;

    trackBusinessEvent({
      businessId,
      eventType: "profile_view",
      source: "business_profile",
      metadata: {
        slug: slug ?? null,
        path:
          typeof window !== "undefined"
            ? window.location.pathname
            : null,
      },
    });
  }, [businessId, slug]);

  return null;
}

export function TrackedBusinessAnchor({
  businessId,
  eventType,
  href,
  children,
  className,
  source = "business_page",
  metadata,
  target,
  rel,
  ariaLabel,
}: {
  businessId: string;
  eventType: BusinessEventType;
  href: string;
  children: ReactNode;
  className?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  target?: string;
  rel?: string;
  ariaLabel?: string;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    trackBusinessEvent({
      businessId,
      eventType,
      source,
      metadata: {
        href,
        label:
          typeof children === "string"
            ? children
            : undefined,
        ...metadata,
      },
    });

    /**
     * Do not prevent default.
     * The user should still go to phone, website, maps, etc.
     */
  }

  return (
    <a
      href={href}
      target={target}
      rel={
        target === "_blank"
          ? rel ?? "noopener noreferrer"
          : rel
      }
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
  metadata,
  ariaLabel,
}: {
  businessId: string;
  eventType: BusinessEventType;
  href: string;
  children: ReactNode;
  className?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  ariaLabel?: string;
}) {
  function handleClick() {
    trackBusinessEvent({
      businessId,
      eventType,
      source,
      metadata: {
        href,
        label:
          typeof children === "string"
            ? children
            : undefined,
        ...metadata,
      },
    });
  }

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={className}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}


"use client";

import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";
import { useMemo } from "react";

import {
  trackBusinessEvent,
  type BusinessEventType,
} from "@/lib/trackBusinessEvent";

type Props = {
  businessId: string;
  href: string;
  eventType: BusinessEventType;
  children: ReactNode;
  className?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  citySlug?: string | null;
  pageType?: string;
  prefetch?: boolean;
} & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick" | "children" | "className"
>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function isInternalHref(href: string): boolean {
  return (
    href.startsWith("/") ||
    href.startsWith("#") ||
    href.startsWith("?")
  );
}

function isSafeExternalHref(href: string): boolean {
  if (
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

function getChildLabel(
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

export default function BusinessTrackedLink({
  businessId,
  href,
  eventType,
  children,
  className,
  source = "business_page",
  metadata,
  citySlug,
  pageType = "business_page",
  prefetch = false,
  target,
  rel,
  "aria-label": ariaLabel,
  ...anchorProps
}: Props) {
  const cleanBusinessId = useMemo(
    () => cleanText(businessId, 80),
    [businessId]
  );

  const cleanHref = useMemo(
    () => cleanText(href, 2_000) ?? "#",
    [href]
  );

  const internal = isInternalHref(cleanHref);

  const safeHref = useMemo(() => {
    if (internal) {
      return cleanHref;
    }

    return isSafeExternalHref(cleanHref)
      ? cleanHref
      : "#";
  }, [cleanHref, internal]);

  function handleClick(
    event: MouseEvent<HTMLAnchorElement>
  ) {
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
          href: safeHref,
          label:
            cleanText(ariaLabel, 200) ??
            getChildLabel(children) ??
            null,
          target: target ?? null,
          modified_click:
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey,
          mouse_button: event.button,
          path: window.location.pathname,
          ...metadata,
        },
      });

      void Promise.resolve(result).catch(
        (error: unknown) => {
          console.error(
            "Business link tracking failed:",
            error
          );
        }
      );
    } catch (error) {
      console.error(
        "Business link tracking failed:",
        error
      );
    }
  }

  if (internal) {
    return (
      <Link
        href={safeHref}
        prefetch={prefetch}
        className={className}
        aria-label={ariaLabel}
        onClick={handleClick}
      >
        {children}
      </Link>
    );
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
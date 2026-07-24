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

const INTERNAL_PROTOCOLS = [
  "/",
  "#",
  "?",
] as const;

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
  return INTERNAL_PROTOCOLS.some((prefix) =>
    href.startsWith(prefix)
  );
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
  const cleanHref = useMemo(
    () => cleanText(href, 2_000) ?? "#",
    [href]
  );

  const internal = isInternalHref(cleanHref);

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
        href: cleanHref,
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
        ...metadata,
      },
    });
  }

  if (internal) {
    return (
      <Link
        href={cleanHref}
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
      href={cleanHref}
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
"use client";

import type {
  AnchorHTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";

import Link from "next/link";

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
  citySlug?: string;
  pageType?: string;
  prefetch?: boolean;
} & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick" | "children" | "className"
>;

function isInternalHref(href: string) {
  return href.startsWith("/");
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
  ...props
}: Props) {
  function handleClick(_event: MouseEvent<HTMLAnchorElement>) {
    trackBusinessEvent({
      businessId,
      eventType,
      source,
      pageType,
      citySlug,
      metadata: {
        href,
        timestamp: new Date().toISOString(),
        ...(metadata ?? {}),
      },
    });
  }

  if (isInternalHref(href)) {
    return (
      <Link
        href={href}
        prefetch={prefetch}
        className={className}
        onClick={handleClick}
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target={target}
      rel={
        rel ??
        (target === "_blank" ? "noopener noreferrer" : undefined)
      }
      className={className}
      onClick={handleClick}
      {...props}
    >
      {children}
    </a>
  );
}


"use client";

import { useEffect } from "react";
import { trackBusinessEvent } from "@/lib/trackBusinessEvent";

export default function BusinessViewTracker({
  businessId,
}: {
  businessId: string;
}) {
  useEffect(() => {
    trackBusinessEvent({
      businessId,
      eventType: "profile_view",
      pageType: "business_page",
    });
  }, [businessId]);

  return null;
}


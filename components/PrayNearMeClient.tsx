"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type PrayerTimes = {
  fajr_begins: string | null;
  fajr_iqamah: string | null;
  sunrise: string | null;
  dhuhr_begins: string | null;
  dhuhr_iqamah: string | null;
  asr_begins: string | null;
  asr_iqamah: string | null;
  maghrib_begins: string | null;
  maghrib_iqamah: string | null;
  isha_begins: string | null;
  isha_iqamah: string | null;
  source: string | null;
  confidence: string | null;
};

type NextIqamah = {
  prayer: string;
  time: string;
  minutes_until: number;
} | null;

type NearbyBusiness = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  maps_url: string | null;
  is_verified: boolean | null;
  featured: boolean | null;
  sponsor_mosque_id: string | null;
  distance_meters: number;
  distance_label: string;
};

type MosqueRecommendation = {
  id: string;
  name: string | null;
  slug: string | null;
  area: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  verified_status: string | null;
  facilities: {
    parking: boolean | null;
    womens_space: boolean | null;
    wheelchair_access: boolean | null;
  };
  distance_meters: number;
  distance_label: string;
  today: string;
  prayer_times: PrayerTimes | null;
  next_iqamah: NextIqamah;
  live: {
    confidence: string;
    hasLive: boolean;
    counts: Record<string, number>;
  };
  salah_score: number;
  nearby_businesses?: NearbyBusiness[];
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  count?: number;
  best?: MosqueRecommendation | null;
  mosques?: MosqueRecommendation[];
};

type BusinessEventType =
  | "profile_view"
  | "profile_click"
  | "phone_click"
  | "website_click"
  | "maps_click"
  | "sponsor_impression"
  | "sponsor_click";

type MosqueEventType =
  | "pray_near_me_impression"
  | "pray_near_me_best_shown"
  | "mosque_profile_click"
  | "mosque_maps_click"
  | "mosque_timetable_click";

type Placement = "best_option" | "nearby_options";

type JsonMetadata = Record<string, unknown>;

type TestLocation = {
  label: string;
  buttonLabel: string;
  lat: number;
  lng: number;
};

type SalahAwareness = {
  current_label: string;
  next_label: string | null;
  next_time: string | null;
  minutes_until_next: number | null;
  status_text: string;
};

type TravelEstimate = {
  walking_minutes: number;
  driving_minutes: number;
  can_walk_to_jamaah: boolean | null;
  can_drive_to_jamaah: boolean | null;
  message: string;
};

const TEST_LOCATIONS: TestLocation[] = [
  {
    label: "Uwaym ibn Sa'ida Mosque test",
    buttonLabel: "Test Uwaym Mosque",
    lat: 29.3325826,
    lng: 47.8119993,
  },
  {
    label: "Kuwait City test",
    buttonLabel: "Test Kuwait City",
    lat: 29.3759,
    lng: 47.9774,
  },
  {
    label: "London test",
    buttonLabel: "Test London",
    lat: 51.5072,
    lng: -0.1276,
  },
  {
    label: "Birmingham test",
    buttonLabel: "Test Birmingham",
    lat: 52.4862,
    lng: -1.8904,
  },
];

// Change this to false before public production launch.
const SHOW_TEST_LOCATIONS = false;

function scoreLabel(score: number) {
  if (score >= 85) return "Excellent option";
  if (score >= 70) return "Good option";
  if (score >= 50) return "Possible option";
  return "Needs timetable";
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 5);
}

function formatMosqueName(value: string | null | undefined) {
  return value?.trim() || "Nearby mosque";
}

function timeStringToMinutes(value: string | null | undefined) {
  if (!value) return null;

  const match = value.match(/^(\d{2}):(\d{2})/);

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function getNowMinutesForTimezone(timezone: string | null | undefined) {
  const safeTimezone = timezone || "Europe/London";

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: safeTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);

    if (Number.isInteger(hour) && Number.isInteger(minute)) {
      return hour * 60 + minute;
    }
  } catch {
    // Fallback below.
  }

  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatMinutesUntil(minutes: number | null) {
  if (minutes === null) return "";
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) return `in ${hours}h`;

  return `in ${hours}h ${mins}m`;
}

function getTravelEstimate(mosque: MosqueRecommendation): TravelEstimate {
  const distanceKm = Math.max(0, mosque.distance_meters / 1000);

  const walkingSpeedKmh = 5;
  const cityDrivingSpeedKmh = 24;
  const bufferMinutes = 3;

  const walkingMinutes = Math.max(
    1,
    Math.ceil((distanceKm / walkingSpeedKmh) * 60)
  );

  const drivingMinutes = Math.max(
    1,
    Math.ceil((distanceKm / cityDrivingSpeedKmh) * 60)
  );

  const jamaahMinutes = mosque.next_iqamah?.minutes_until ?? null;

  if (jamaahMinutes === null) {
    return {
      walking_minutes: walkingMinutes,
      driving_minutes: drivingMinutes,
      can_walk_to_jamaah: null,
      can_drive_to_jamaah: null,
      message:
        "No jamaʿah time has been found yet, so arrival confidence is based on distance only.",
    };
  }

  const canWalk = walkingMinutes + bufferMinutes <= jamaahMinutes;
  const canDrive = drivingMinutes + bufferMinutes <= jamaahMinutes;

  if (canWalk) {
    return {
      walking_minutes: walkingMinutes,
      driving_minutes: drivingMinutes,
      can_walk_to_jamaah: true,
      can_drive_to_jamaah: true,
      message: "You can likely walk and still reach jamaʿah in shā Allah.",
    };
  }

  if (canDrive) {
    return {
      walking_minutes: walkingMinutes,
      driving_minutes: drivingMinutes,
      can_walk_to_jamaah: false,
      can_drive_to_jamaah: true,
      message:
        "Walking may be tight, but driving should reach jamaʿah in shā Allah.",
    };
  }

  return {
    walking_minutes: walkingMinutes,
    driving_minutes: drivingMinutes,
    can_walk_to_jamaah: false,
    can_drive_to_jamaah: false,
    message:
      "This jamaʿah may be difficult to reach on time. Consider another nearby option or the next prayer.",
  };
}

function formatCategory(value: string | null | undefined) {
  if (!value) return "Halal business";

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normaliseExternalUrl(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();

  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function mapsUrl(mosque: MosqueRecommendation) {
  if (
    typeof mosque.latitude === "number" &&
    typeof mosque.longitude === "number"
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${mosque.latitude},${mosque.longitude}`;
  }

  const query = [
    mosque.name,
    mosque.address,
    mosque.area,
    mosque.city,
    mosque.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`;
}

function businessMapsUrl(business: NearbyBusiness) {
  const savedMapUrl = normaliseExternalUrl(business.maps_url);

  if (savedMapUrl) return savedMapUrl;

  if (
    typeof business.latitude === "number" &&
    typeof business.longitude === "number"
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`;
  }

  const query = [
    business.name,
    business.address,
    business.area,
    business.city,
    business.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`;
}

function timetableHref(mosque: MosqueRecommendation) {
  if (!mosque.slug) return null;

  const [year, month] = mosque.today.split("-");

  if (!year || !month) {
    return `/mosque/${mosque.slug}/timetable`;
  }

  return `/mosque/${mosque.slug}/timetable?month=${Number(
    month
  )}&year=${Number(year)}`;
}

function mosqueHref(mosque: MosqueRecommendation) {
  return mosque.slug ? `/mosque/${mosque.slug}` : null;
}

function businessHref(business: NearbyBusiness) {
  return business.slug ? `/business/${business.slug}` : null;
}

function getNextIqamahText(nextIqamah: NextIqamah) {
  if (!nextIqamah) return "No jamaʿah time found";

  if (nextIqamah.minutes_until === 0) {
    return `${nextIqamah.prayer} now`;
  }

  return `${nextIqamah.prayer} in ${nextIqamah.minutes_until} min`;
}

function getPrayerTimeSummary(mosque: MosqueRecommendation) {
  const times = mosque.prayer_times;

  if (!times) return "No official timetable for today";

  return `Fajr ${formatTime(
    times.fajr_iqamah ?? times.fajr_begins
  )} • Dhuhr ${formatTime(
    times.dhuhr_iqamah ?? times.dhuhr_begins
  )} • Asr ${formatTime(
    times.asr_iqamah ?? times.asr_begins
  )} • Maghrib ${formatTime(
    times.maghrib_iqamah ?? times.maghrib_begins
  )} • Isha ${formatTime(times.isha_iqamah ?? times.isha_begins)}`;
}

function getSalahAwareness(mosque: MosqueRecommendation): SalahAwareness | null {
  const times = mosque.prayer_times;

  if (!times) return null;

  const nowMinutes = getNowMinutesForTimezone(mosque.timezone);

  const fajr = timeStringToMinutes(times.fajr_begins);
  const sunrise = timeStringToMinutes(times.sunrise);
  const dhuhr = timeStringToMinutes(times.dhuhr_begins);
  const asr = timeStringToMinutes(times.asr_begins);
  const maghrib = timeStringToMinutes(times.maghrib_begins);
  const isha = timeStringToMinutes(times.isha_begins);

  const prayerTimes = [
    { label: "Fajr", minutes: fajr, time: times.fajr_begins },
    { label: "Dhuhr", minutes: dhuhr, time: times.dhuhr_begins },
    { label: "Asr", minutes: asr, time: times.asr_begins },
    { label: "Maghrib", minutes: maghrib, time: times.maghrib_begins },
    { label: "Isha", minutes: isha, time: times.isha_begins },
  ].filter(
    (
      item
    ): item is {
      label: string;
      minutes: number;
      time: string;
    } => typeof item.minutes === "number" && Boolean(item.time)
  );

  const nextPrayer = prayerTimes.find((item) => item.minutes > nowMinutes);

  if (fajr !== null && nowMinutes < fajr) {
    return {
      current_label: "Before Fajr",
      next_label: "Fajr",
      next_time: times.fajr_begins,
      minutes_until_next: fajr - nowMinutes,
      status_text: `Fajr has not entered yet. Fajr begins ${formatMinutesUntil(
        fajr - nowMinutes
      )}.`,
    };
  }

  if (
    fajr !== null &&
    sunrise !== null &&
    nowMinutes >= fajr &&
    nowMinutes < sunrise
  ) {
    return {
      current_label: "Fajr window",
      next_label: "Sunrise",
      next_time: times.sunrise,
      minutes_until_next: sunrise - nowMinutes,
      status_text: `You are currently in the Fajr window. Sunrise is ${formatMinutesUntil(
        sunrise - nowMinutes
      )}.`,
    };
  }

  if (
    sunrise !== null &&
    dhuhr !== null &&
    nowMinutes >= sunrise &&
    nowMinutes < dhuhr
  ) {
    return {
      current_label: "After sunrise",
      next_label: "Dhuhr",
      next_time: times.dhuhr_begins,
      minutes_until_next: dhuhr - nowMinutes,
      status_text: `Fajr has passed. Dhuhr begins ${formatMinutesUntil(
        dhuhr - nowMinutes
      )}.`,
    };
  }

  if (dhuhr !== null && asr !== null && nowMinutes >= dhuhr && nowMinutes < asr) {
    return {
      current_label: "Dhuhr window",
      next_label: "Asr",
      next_time: times.asr_begins,
      minutes_until_next: asr - nowMinutes,
      status_text: `You are currently in the Dhuhr window. Asr begins ${formatMinutesUntil(
        asr - nowMinutes
      )}.`,
    };
  }

  if (
    asr !== null &&
    maghrib !== null &&
    nowMinutes >= asr &&
    nowMinutes < maghrib
  ) {
    return {
      current_label: "Asr window",
      next_label: "Maghrib",
      next_time: times.maghrib_begins,
      minutes_until_next: maghrib - nowMinutes,
      status_text: `You are currently in the Asr window. Maghrib begins ${formatMinutesUntil(
        maghrib - nowMinutes
      )}.`,
    };
  }

  if (
    maghrib !== null &&
    isha !== null &&
    nowMinutes >= maghrib &&
    nowMinutes < isha
  ) {
    return {
      current_label: "Maghrib window",
      next_label: "Isha",
      next_time: times.isha_begins,
      minutes_until_next: isha - nowMinutes,
      status_text: `You are currently in the Maghrib window. Isha begins ${formatMinutesUntil(
        isha - nowMinutes
      )}.`,
    };
  }

  if (isha !== null && nowMinutes >= isha) {
    return {
      current_label: "Isha / night window",
      next_label: "Fajr tomorrow",
      next_time: null,
      minutes_until_next: null,
      status_text: "Isha has entered. You are now in the night prayer window.",
    };
  }

  if (nextPrayer) {
    return {
      current_label: "Upcoming salah",
      next_label: nextPrayer.label,
      next_time: nextPrayer.time,
      minutes_until_next: nextPrayer.minutes - nowMinutes,
      status_text: `${nextPrayer.label} begins ${formatMinutesUntil(
        nextPrayer.minutes - nowMinutes
      )}.`,
    };
  }

  return null;
}

function getRecommendationReasons(mosque: MosqueRecommendation) {
  const reasons: string[] = [];
  const salahAwareness = getSalahAwareness(mosque);
  const travelEstimate = getTravelEstimate(mosque);

  if (salahAwareness) {
    reasons.push(`Current salah context: ${salahAwareness.current_label}`);
  }

  if (mosque.salah_score >= 85) {
    reasons.push(`Strong Salah Score: ${mosque.salah_score}`);
  } else if (mosque.salah_score >= 70) {
    reasons.push(`Good Salah Score: ${mosque.salah_score}`);
  } else if (mosque.salah_score >= 50) {
    reasons.push(`Best available nearby option with score ${mosque.salah_score}`);
  } else {
    reasons.push(`Closest useful option found with score ${mosque.salah_score}`);
  }

  if (mosque.distance_meters <= 500) {
    reasons.push(`Very close — only ${mosque.distance_label} away`);
  } else if (mosque.distance_meters <= 2000) {
    reasons.push(`Close to you — ${mosque.distance_label} away`);
  } else if (mosque.distance_meters <= 5000) {
    reasons.push(`Nearby within your search area — ${mosque.distance_label}`);
  } else {
    reasons.push(`Within your selected search radius — ${mosque.distance_label}`);
  }

  if (travelEstimate.can_walk_to_jamaah === true) {
    reasons.push(
      `You can likely walk there in ${travelEstimate.walking_minutes} min`
    );
  } else if (travelEstimate.can_drive_to_jamaah === true) {
    reasons.push(`Driving estimate is ${travelEstimate.driving_minutes} min`);
  } else if (travelEstimate.can_drive_to_jamaah === false) {
    reasons.push("Travel time may be tight for the next jamaʿah");
  }

  if (mosque.prayer_times) {
    reasons.push("Today’s mosque timetable is available");
  } else {
    reasons.push("No timetable yet, but it is still one of the best nearby options");
  }

  if (mosque.next_iqamah) {
    if (mosque.next_iqamah.minutes_until <= 20) {
      reasons.push(
        `${mosque.next_iqamah.prayer} jamaʿah is soon — in ${mosque.next_iqamah.minutes_until} minutes`
      );
    } else {
      reasons.push(
        `Next jamaʿah found: ${mosque.next_iqamah.prayer} at ${formatTime(
          mosque.next_iqamah.time
        )}`
      );
    }
  } else {
    reasons.push("No jamaʿah time found yet, so distance and availability were prioritised");
  }

  if (mosque.live.hasLive) {
    reasons.push(`Live community status has ${mosque.live.confidence} confidence`);
  }

  if (mosque.verified_status) {
    reasons.push(`Mosque record status: ${formatCategory(mosque.verified_status)}`);
  }

  if (mosque.facilities.parking) {
    reasons.push("Parking is listed");
  }

  if (mosque.facilities.womens_space) {
    reasons.push("Women’s space is listed");
  }

  if (mosque.facilities.wheelchair_access) {
    reasons.push("Wheelchair access is listed");
  }

  const nearbyBusinessCount = mosque.nearby_businesses?.length ?? 0;

  if (nearbyBusinessCount > 0) {
    reasons.push(
      `${nearbyBusinessCount} halal ${
        nearbyBusinessCount === 1 ? "place" : "places"
      } nearby after Salah`
    );
  }

  return reasons.slice(0, 6);
}

function getPlacement(mosqueId: string, bestMosqueId: string | null): Placement {
  return mosqueId === bestMosqueId ? "best_option" : "nearby_options";
}

function mosqueMetadata({
  mosque,
  label,
  href,
  placement,
  rank,
  radius,
  locationLabel,
}: {
  mosque: MosqueRecommendation;
  label: string;
  href?: string | null;
  placement: Placement;
  rank?: number | null;
  radius?: number | null;
  locationLabel?: string | null;
}): JsonMetadata {
  return {
    page_type: "pray_near_me",
    placement,
    rank: rank ?? null,
    label,
    href: href ?? null,
    radius_meters: radius ?? null,
    search_location_label: locationLabel ?? null,
    mosque_id: mosque.id,
    mosque_name: mosque.name,
    mosque_slug: mosque.slug,
    mosque_city: mosque.city,
    mosque_area: mosque.area,
    mosque_postcode: mosque.postcode,
    mosque_distance_meters: mosque.distance_meters,
    mosque_distance_label: mosque.distance_label,
    salah_score: mosque.salah_score,
    prayer_times_available: Boolean(mosque.prayer_times),
    live_confidence: mosque.live.confidence,
    live_has_reports: mosque.live.hasLive,
    next_iqamah_prayer: mosque.next_iqamah?.prayer ?? null,
    next_iqamah_time: mosque.next_iqamah?.time ?? null,
    next_iqamah_minutes_until: mosque.next_iqamah?.minutes_until ?? null,
    facilities_parking: mosque.facilities.parking,
    facilities_womens_space: mosque.facilities.womens_space,
    facilities_wheelchair_access: mosque.facilities.wheelchair_access,
    nearby_business_count: mosque.nearby_businesses?.length ?? 0,
  };
}

function sendTrackingEvent(endpoint: string, payload: Record<string, unknown>) {
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });

      const sent = navigator.sendBeacon(endpoint, blob);

      if (sent) return;
    }

    void fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => null);
  } catch {
    // Tracking must never break the user journey.
  }
}

function trackMosqueEvent({
  mosque,
  eventType,
  label,
  href,
  placement,
  rank,
  radius,
  locationLabel,
}: {
  mosque: MosqueRecommendation;
  eventType: MosqueEventType;
  label: string;
  href?: string | null;
  placement: Placement;
  rank?: number | null;
  radius?: number | null;
  locationLabel?: string | null;
}) {
  sendTrackingEvent("/api/mosque/track-event", {
    mosque_id: mosque.id,
    event_type: eventType,
    source: "pray_near_me",
    metadata: mosqueMetadata({
      mosque,
      label,
      href,
      placement,
      rank,
      radius,
      locationLabel,
    }),
  });
}

function trackNearbyBusinessClick({
  business,
  mosque,
  eventType,
  label,
  href,
}: {
  business: NearbyBusiness;
  mosque: MosqueRecommendation;
  eventType: BusinessEventType;
  label: string;
  href?: string | null;
}) {
  sendTrackingEvent("/api/business/track-event", {
    business_id: business.id,
    event_type: eventType,
    source: "pray_near_me_after_salah",
    metadata: {
      page_type: "pray_near_me",
      placement: "after_salah_nearby",
      label,
      href: href ?? null,
      mosque_id: mosque.id,
      mosque_name: mosque.name,
      mosque_slug: mosque.slug,
      mosque_city: mosque.city,
      mosque_distance_meters: mosque.distance_meters,
      mosque_distance_label: mosque.distance_label,
      salah_score: mosque.salah_score,
      next_iqamah_prayer: mosque.next_iqamah?.prayer ?? null,
      next_iqamah_time: mosque.next_iqamah?.time ?? null,
      next_iqamah_minutes_until: mosque.next_iqamah?.minutes_until ?? null,
      business_name: business.name,
      business_slug: business.slug,
      business_category: business.category,
      business_distance_meters: business.distance_meters,
      business_distance_label: business.distance_label,
      business_supports_mosque: business.sponsor_mosque_id === mosque.id,
    },
  });
}

export default function PrayNearMeClient() {
  const [loading, setLoading] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [radius, setRadius] = useState(5000);
  const [lastLocationLabel, setLastLocationLabel] = useState<string | null>(
    null
  );

  const trackedResultKeyRef = useRef<string | null>(null);

  const mosques = useMemo(() => data?.mosques ?? [], [data]);
  const bestMosque = data?.best ?? null;
  const bestMosqueId = bestMosque?.id ?? null;

  useEffect(() => {
    if (!data?.ok || !bestMosque || mosques.length === 0) return;

    const resultKey = [
      bestMosque.id,
      mosques.map((mosque) => mosque.id).join(","),
      radius,
      lastLocationLabel ?? "unknown",
    ].join("|");

    if (trackedResultKeyRef.current === resultKey) return;

    trackedResultKeyRef.current = resultKey;

    trackMosqueEvent({
      mosque: bestMosque,
      eventType: "pray_near_me_best_shown",
      label: "Best mosque shown in Pray Near Me",
      placement: "best_option",
      rank: 1,
      radius,
      locationLabel: lastLocationLabel,
    });

    mosques.forEach((mosque, index) => {
      trackMosqueEvent({
        mosque,
        eventType: "pray_near_me_impression",
        label: "Mosque shown in Pray Near Me results",
        placement: getPlacement(mosque.id, bestMosque.id),
        rank: index + 1,
        radius,
        locationLabel: lastLocationLabel,
      });
    });
  }, [data, bestMosque, mosques, radius, lastLocationLabel]);

  async function loadRecommendations(
    lat: number,
    lng: number,
    label = "Current location"
  ) {
    try {
      setLoading(true);
      setErrorMessage("");
      setLocationDenied(false);
      setData(null);
      setLastLocationLabel(label);

      const res = await fetch(
        `/api/near-me/pray?lat=${encodeURIComponent(
          lat
        )}&lng=${encodeURIComponent(lng)}&radius=${radius}`,
        {
          cache: "no-store",
        }
      );

      const json = (await res.json().catch(() => ({}))) as ApiResponse;

      if (!res.ok || !json.ok) {
        setErrorMessage(json.error ?? "Could not load nearby prayer options.");
        return;
      }

      setData(json);
    } catch {
      setErrorMessage("Could not load nearby prayer options.");
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    setErrorMessage("");
    setLocationDenied(false);

    if (!navigator.geolocation) {
      setErrorMessage("Your browser does not support location access.");
      return;
    }

    setLoading(true);
    setData(null);
    setLastLocationLabel("Detecting location");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void loadRecommendations(
          position.coords.latitude,
          position.coords.longitude,
          "Your location"
        );
      },
      () => {
        setLoading(false);
        setLocationDenied(true);
        setLastLocationLabel(null);
        setErrorMessage("Location permission was denied.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:py-10">
      <section className="luxe-card relative overflow-hidden rounded-3xl p-6 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_40%)]" />

        <div className="relative z-10">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Pray Near Me
          </div>

          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">
            Find the best mosque to pray now
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-8 text-white/70 md:text-lg">
            SalahNearMe checks your distance, today’s mosque timetable, current
            salah context, estimated travel time, live community signals,
            facilities, and nearby halal places to recommend the best available
            prayer option.
          </p>

          <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <select
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="w-full rounded-xl border border-yellow-500/20 bg-black px-4 py-3 text-sm font-semibold text-white outline-none sm:w-auto"
            >
              <option value={2000}>Within 2km</option>
              <option value={5000}>Within 5km</option>
              <option value={10000}>Within 10km</option>
              <option value={20000}>Within 20km</option>
            </select>

            <button
              type="button"
              onClick={useMyLocation}
              disabled={loading}
              className="w-full rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-black hover:bg-yellow-400 disabled:opacity-50 sm:w-auto"
            >
              {loading ? "Finding mosques..." : "Use my location"}
            </button>

            <Link
              href="/travel/near-me"
              className="w-full rounded-xl border border-white/10 px-5 py-3 text-center text-sm font-bold text-white/70 hover:bg-white/10 sm:w-auto"
            >
              General near me
            </Link>

            {SHOW_TEST_LOCATIONS ? (
              <div className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="mb-3 text-xs uppercase tracking-[0.2em] text-white/40">
                  Testing tools
                </div>

                <div className="flex flex-wrap gap-3">
                  {TEST_LOCATIONS.map((location) => (
                    <button
                      key={location.label}
                      type="button"
                      onClick={() =>
                        loadRecommendations(
                          location.lat,
                          location.lng,
                          location.label
                        )
                      }
                      disabled={loading}
                      className="rounded-xl border border-yellow-500/30 px-5 py-3 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50"
                    >
                      {location.buttonLabel}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {lastLocationLabel ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/60">
              Search area:{" "}
              <span className="font-semibold text-yellow-300">
                {lastLocationLabel}
              </span>{" "}
              • Radius:{" "}
              <span className="font-semibold text-yellow-300">
                {(radius / 1000).toFixed(0)}km
              </span>
            </div>
          ) : null}

          {locationDenied ? (
            <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
              Location was denied. Allow location access in your browser, then
              try again — or use one of the test buttons.
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </section>

      {loading ? (
        <section className="mt-8 rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-6">
          <div className="text-sm uppercase tracking-[0.22em] text-yellow-300">
            Searching
          </div>

          <div className="mt-3 text-2xl font-black text-white">
            Finding your best prayer option…
          </div>

          <p className="mt-2 text-sm text-yellow-100/80">
            Checking nearby mosques, today’s timetable, live reports, estimated
            travel time, facilities, and halal places nearby.
          </p>
        </section>
      ) : null}

      {bestMosque ? (
        <BestMosqueCard
          mosque={bestMosque}
          radius={radius}
          locationLabel={lastLocationLabel}
        />
      ) : null}

      {data && mosques.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-6">
          <div className="text-sm uppercase tracking-[0.22em] text-yellow-300">
            No nearby mosque found
          </div>

          <div className="mt-3 text-2xl font-black text-white">
            Try a wider search radius
          </div>

          <p className="mt-2 text-sm text-yellow-100/80">
            We could not find an active mosque with coordinates in this radius.
            Increase the distance or try another location.
          </p>
        </section>
      ) : null}

      {mosques.length > 0 ? (
        <section className="mt-8">
          <div className="mb-4 text-2xl font-black text-white">
            Nearby prayer options
          </div>

          <div className="grid gap-4">
            {mosques.map((mosque, index) => (
              <MosqueResultCard
                key={mosque.id}
                mosque={mosque}
                rank={index + 1}
                bestMosqueId={bestMosqueId}
                radius={radius}
                locationLabel={lastLocationLabel}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function BestMosqueCard({
  mosque,
  radius,
  locationLabel,
}: {
  mosque: MosqueRecommendation;
  radius: number;
  locationLabel: string | null;
}) {
  const profileHref = mosqueHref(mosque);
  const mapHref = mapsUrl(mosque);
  const monthlyTimetableHref = timetableHref(mosque);

  return (
    <section className="mt-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 md:p-6">
      <div className="text-sm uppercase tracking-[0.25em] text-emerald-300">
        Best option now
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h2
            dir="auto"
            className="text-3xl font-black leading-tight text-white md:text-4xl"
          >
            {formatMosqueName(mosque.name)}
          </h2>

          <p className="mt-2 text-white/70">
            {[mosque.area, mosque.city, mosque.postcode]
              .filter(Boolean)
              .join(" • ")}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{mosque.distance_label}</Badge>
            <Badge>{scoreLabel(mosque.salah_score)}</Badge>
            <Badge>{getNextIqamahText(mosque.next_iqamah)}</Badge>

            {mosque.facilities.parking ? <Badge>Parking</Badge> : null}

            {mosque.facilities.womens_space ? (
              <Badge>Women’s space</Badge>
            ) : null}

            {mosque.facilities.wheelchair_access ? (
              <Badge>Wheelchair access</Badge>
            ) : null}

            {mosque.nearby_businesses &&
            mosque.nearby_businesses.length > 0 ? (
              <Badge>{mosque.nearby_businesses.length} halal places nearby</Badge>
            ) : null}
          </div>

          <p className="mt-5 text-sm leading-7 text-white/70">
            {getPrayerTimeSummary(mosque)}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {profileHref ? (
              <Link
                href={profileHref}
                onClick={() =>
                  trackMosqueEvent({
                    mosque,
                    eventType: "mosque_profile_click",
                    label: "View best mosque from Pray Near Me",
                    href: profileHref,
                    placement: "best_option",
                    rank: 1,
                    radius,
                    locationLabel,
                  })
                }
                className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-400"
              >
                View mosque
              </Link>
            ) : null}

            <a
              href={mapHref}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                trackMosqueEvent({
                  mosque,
                  eventType: "mosque_maps_click",
                  label: "Open maps for best mosque from Pray Near Me",
                  href: mapHref,
                  placement: "best_option",
                  rank: 1,
                  radius,
                  locationLabel,
                })
              }
              className="rounded-xl border border-yellow-500/30 px-5 py-3 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
            >
              Open maps
            </a>

            {monthlyTimetableHref ? (
              <Link
                href={monthlyTimetableHref}
                onClick={() =>
                  trackMosqueEvent({
                    mosque,
                    eventType: "mosque_timetable_click",
                    label: "Open timetable for best mosque from Pray Near Me",
                    href: monthlyTimetableHref,
                    placement: "best_option",
                    rank: 1,
                    radius,
                    locationLabel,
                  })
                }
                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-white/70 hover:bg-white/10"
              >
                Timetable
              </Link>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-500/20 bg-black/30 p-6">
          <div className="text-sm font-bold text-emerald-300">Salah Score</div>

          <div className="mt-3 text-6xl font-black text-white">
            {mosque.salah_score}
          </div>

          <div className="mt-2 text-sm leading-6 text-white/60">
            Calculated from distance, timetable availability, current salah
            context, jamaʿah timing, estimated travel time, live signals,
            facilities, and nearby halal ecosystem value.
          </div>
        </div>
      </div>

      <CurrentSalahAwarenessCard mosque={mosque} />

      <CanIMakeItCard mosque={mosque} />

      <RecommendationReasons mosque={mosque} />

      <AfterSalahBusinesses mosque={mosque} highlight />

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-white/45">
        SalahNearMe recommendations are based on available mosque data,
        distance, timetable records, and community signals. Always confirm
        directly with the mosque if the timing is critical.
      </div>
    </section>
  );
}

function MosqueResultCard({
  mosque,
  rank,
  bestMosqueId,
  radius,
  locationLabel,
}: {
  mosque: MosqueRecommendation;
  rank: number;
  bestMosqueId: string | null;
  radius: number;
  locationLabel: string | null;
}) {
  const profileHref = mosqueHref(mosque);
  const mapHref = mapsUrl(mosque);
  const monthlyTimetableHref = timetableHref(mosque);
  const placement = getPlacement(mosque.id, bestMosqueId);

  return (
    <article className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            #{rank} • Salah Score {mosque.salah_score}
          </div>

          <h3
            dir="auto"
            className="mt-2 text-2xl font-black leading-tight text-white"
          >
            {formatMosqueName(mosque.name)}
          </h3>

          <p className="mt-1 text-sm text-white/50">
            {[mosque.area, mosque.city, mosque.postcode]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>

        <div className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-sm font-bold text-yellow-300">
          {mosque.distance_label}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge>{scoreLabel(mosque.salah_score)}</Badge>
        <Badge>{getNextIqamahText(mosque.next_iqamah)}</Badge>
        <Badge>Live: {mosque.live.confidence}</Badge>

        {mosque.prayer_times ? (
          <Badge>Timetable available</Badge>
        ) : (
          <Badge>Timetable missing</Badge>
        )}

        {mosque.nearby_businesses && mosque.nearby_businesses.length > 0 ? (
          <Badge>{mosque.nearby_businesses.length} halal places nearby</Badge>
        ) : null}
      </div>

      <p className="mt-4 text-sm leading-7 text-white/60">
        {getPrayerTimeSummary(mosque)}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        {profileHref ? (
          <Link
            href={profileHref}
            onClick={() =>
              trackMosqueEvent({
                mosque,
                eventType: "mosque_profile_click",
                label: "View mosque from Pray Near Me list",
                href: profileHref,
                placement,
                rank,
                radius,
                locationLabel,
              })
            }
            className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-400"
          >
            View mosque
          </Link>
        ) : null}

        <a
          href={mapHref}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            trackMosqueEvent({
              mosque,
              eventType: "mosque_maps_click",
              label: "Open mosque map from Pray Near Me list",
              href: mapHref,
              placement,
              rank,
              radius,
              locationLabel,
            })
          }
          className="rounded-xl border border-yellow-500/30 px-4 py-2 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
        >
          Maps
        </a>

        {monthlyTimetableHref ? (
          <Link
            href={monthlyTimetableHref}
            onClick={() =>
              trackMosqueEvent({
                mosque,
                eventType: "mosque_timetable_click",
                label: "Open mosque timetable from Pray Near Me list",
                href: monthlyTimetableHref,
                placement,
                rank,
                radius,
                locationLabel,
              })
            }
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10"
          >
            Timetable
          </Link>
        ) : null}
      </div>

      <AfterSalahBusinesses mosque={mosque} />
    </article>
  );
}

function CanIMakeItCard({ mosque }: { mosque: MosqueRecommendation }) {
  const estimate = getTravelEstimate(mosque);
  const jamaahMinutes = mosque.next_iqamah?.minutes_until ?? null;

  const resultClass =
    estimate.can_walk_to_jamaah === true ||
    estimate.can_drive_to_jamaah === true
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
      : estimate.can_drive_to_jamaah === false
        ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-100"
        : "border-white/10 bg-black/30 text-white/70";

  return (
    <div className="mt-6 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4">
      <div className="text-sm uppercase tracking-[0.2em] text-purple-300">
        Can I make it?
      </div>

      <p className="mt-1 text-xs text-white/50">
        SalahNearMe estimates whether you can reach this mosque before jamaʿah.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Walk"
          value={`${estimate.walking_minutes} min`}
          description="Approximate walking time."
        />

        <MetricCard
          label="Drive"
          value={`${estimate.driving_minutes} min`}
          description="Approximate city driving time."
        />

        <MetricCard
          label="Jamaʿah"
          value={jamaahMinutes === null ? "—" : `${jamaahMinutes} min`}
          description={
            mosque.next_iqamah
              ? `${mosque.next_iqamah.prayer} jamaʿah estimate`
              : "No jamaʿah time found"
          }
        />
      </div>

      <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${resultClass}`}>
        {estimate.message}
      </div>

      <p className="mt-3 text-xs text-white/40">
        Estimates are based on distance only. Live traffic will be added later.
      </p>
    </div>
  );
}

function CurrentSalahAwarenessCard({
  mosque,
}: {
  mosque: MosqueRecommendation;
}) {
  const awareness = getSalahAwareness(mosque);

  if (!awareness) {
    return (
      <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-300">
          Current salah context
        </div>

        <p className="mt-2 text-sm text-yellow-100">
          No mosque timetable is available yet, so SalahNearMe cannot determine
          the current prayer window for this mosque.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
      <div className="text-sm uppercase tracking-[0.2em] text-cyan-300">
        Current salah context
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
        <MetricCard label="Now" value={awareness.current_label} />

        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">
            Next
          </div>

          <div className="mt-2 text-lg font-bold text-white">
            {awareness.next_label
              ? `${awareness.next_label}${
                  awareness.next_time
                    ? ` at ${formatTime(awareness.next_time)}`
                    : ""
                }`
              : "No next prayer found"}
          </div>

          <p className="mt-2 text-sm text-white/60">
            {awareness.status_text}
          </p>
        </div>
      </div>
    </div>
  );
}

function RecommendationReasons({ mosque }: { mosque: MosqueRecommendation }) {
  const reasons = getRecommendationReasons(mosque);

  if (reasons.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-black/25 p-4">
      <div className="text-sm uppercase tracking-[0.2em] text-emerald-300">
        Why this mosque?
      </div>

      <p className="mt-1 text-xs text-white/50">
        SalahNearMe explains why this mosque was recommended.
      </p>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {reasons.map((reason) => (
          <div
            key={reason}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white/70"
          >
            <span className="mr-2 text-emerald-300">✓</span>
            {reason}
          </div>
        ))}
      </div>
    </div>
  );
}

function AfterSalahBusinesses({
  mosque,
  highlight = false,
}: {
  mosque: MosqueRecommendation;
  highlight?: boolean;
}) {
  const businesses = mosque.nearby_businesses ?? [];

  if (businesses.length === 0) {
    return (
      <div
        className={`mt-6 rounded-2xl border p-4 text-sm ${
          highlight
            ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-100"
            : "border-white/10 bg-black/20 text-white/50"
        }`}
      >
        No halal businesses have been linked near this mosque yet.
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-black/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            After Salah nearby
          </div>

          <p className="mt-1 text-xs text-white/50">
            Halal places close to this mosque.
          </p>
        </div>

        <div className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
          {businesses.length} suggestions
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {businesses.map((business) => {
          const href = businessHref(business);
          const mapHref = businessMapsUrl(business);
          const website = normaliseExternalUrl(business.website);
          const phoneHref = business.phone ? `tel:${business.phone}` : null;

          return (
            <div
              key={business.id}
              className="rounded-2xl border border-white/10 bg-black/40 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-white">
                    {business.name ?? "Halal business"}
                  </div>

                  <div className="mt-1 text-xs text-white/50">
                    {formatCategory(business.category)}
                  </div>
                </div>

                <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-300">
                  {business.distance_label}
                </div>
              </div>

              <div className="mt-3 text-xs text-white/50">
                {[business.area, business.city, business.postcode]
                  .filter(Boolean)
                  .join(" • ")}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {business.is_verified ? (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300">
                    Verified
                  </span>
                ) : null}

                {business.featured ? (
                  <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-[11px] font-bold text-yellow-300">
                    Featured
                  </span>
                ) : null}

                {business.sponsor_mosque_id === mosque.id ? (
                  <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-[11px] font-bold text-yellow-300">
                    Supports this mosque
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {href ? (
                  <Link
                    href={href}
                    onClick={() =>
                      trackNearbyBusinessClick({
                        business,
                        mosque,
                        eventType: "profile_click",
                        label: "View business from Pray Near Me",
                        href,
                      })
                    }
                    className="rounded-lg bg-yellow-500 px-3 py-2 text-xs font-bold text-black hover:bg-yellow-400"
                  >
                    View
                  </Link>
                ) : null}

                <a
                  href={mapHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    trackNearbyBusinessClick({
                      business,
                      mosque,
                      eventType: "maps_click",
                      label: "Map click from Pray Near Me",
                      href: mapHref,
                    })
                  }
                  className="rounded-lg border border-yellow-500/30 px-3 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
                >
                  Map
                </a>

                {website ? (
                  <a
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() =>
                      trackNearbyBusinessClick({
                        business,
                        mosque,
                        eventType: "website_click",
                        label: "Website click from Pray Near Me",
                        href: website,
                      })
                    }
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10"
                  >
                    Website
                  </a>
                ) : null}

                {phoneHref ? (
                  <a
                    href={phoneHref}
                    onClick={() =>
                      trackNearbyBusinessClick({
                        business,
                        mosque,
                        eventType: "phone_click",
                        label: "Phone click from Pray Near Me",
                        href: phoneHref,
                      })
                    }
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10"
                  >
                    Call
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black text-white">{value}</div>

      {description ? (
        <p className="mt-2 text-xs text-white/50">{description}</p>
      ) : null}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
      {children}
    </span>
  );
}


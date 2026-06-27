export type ImportType = "mosques" | "businesses";

export type ImportErrorRow = {
  row: number;
  message: string;
  data: Record<string, unknown>;
};

export type ImportSummary = {
  type: ImportType;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  insertCount: number;
  updateCount: number;
  duplicateCandidatesQueued?: number;
  errors: ImportErrorRow[];
  rows: Record<string, unknown>[];
};

const BUSINESS_CATEGORIES = new Set([
  "Restaurant",
  "Takeaway",
  "Butcher",
  "Grocery",
  "Dessert",
  "Clinic",
  "Pharmacy",
  "Bookshop",
  "Clothing",
  "Islamic Centre",
  "Hijama",
  "Tuition",
  "Car Repair",
  "Taxi",
  "Funeral Services",
  "Charity",
  "Travel",
  "Automotive",
]);

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

function cleanBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return defaultValue;

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return defaultValue;
}

function cleanNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCity(value: unknown) {
  const city = cleanString(value);
  if (!city) return null;

  return city
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizePostcode(value: unknown) {
  const postcode = cleanString(value);
  return postcode ? postcode.toUpperCase().replace(/\s+/g, " ").trim() : null;
}

function isValidUrl(value: string | null) {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isValidEmail(value: string | null) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(value: unknown) {
  const phone = cleanString(value);
  if (!phone) return null;
  return phone.replace(/\s+/g, " ").trim();
}

export function normalizeMosqueRow(row: Record<string, unknown>) {
  const name = cleanString(row.name);
  const city = normalizeCity(row.city);

  return {
    name,
    slug: cleanString(row.slug) ?? (name ? slugify(name) : null),
    city,
    area: cleanString(row.area),
    postcode: normalizePostcode(row.postcode),
    address: cleanString(row.address),
    maps_url: cleanString(row.maps_url),
    latitude: cleanNumber(row.latitude),
    longitude: cleanNumber(row.longitude),
    verified_status: cleanString(row.verified_status) ?? "pending",
  };
}

export function normalizeBusinessRow(row: Record<string, unknown>) {
  const name = cleanString(row.name);
  const city = normalizeCity(row.city);
  const category = cleanString(row.category);

  return {
    name,
    slug: cleanString(row.slug) ?? (name ? slugify(name) : null),
    category,
    city,
    area: cleanString(row.area),
    address: cleanString(row.address),
    postcode: normalizePostcode(row.postcode),
    website: cleanString(row.website),
    phone: normalizePhone(row.phone),
    email: cleanString(row.email),
    maps_url: cleanString(row.maps_url),
    latitude: cleanNumber(row.latitude),
    longitude: cleanNumber(row.longitude),
    status: cleanString(row.status) ?? "approved",
    can_advertise: cleanBoolean(row.can_advertise, true),
    is_verified: cleanBoolean(row.is_verified, false),
    featured: false,
    pricing_tier: "free",
  };
}

export function validateMosqueRow(
  row: ReturnType<typeof normalizeMosqueRow>,
  index: number
) {
  const errors: string[] = [];

  if (!row.name) errors.push("Missing mosque name");
  if (!row.city) errors.push("Missing city");
  if (row.maps_url && !isValidUrl(row.maps_url)) errors.push("Invalid maps_url");

  if (row.latitude !== null && (row.latitude < -90 || row.latitude > 90)) {
    errors.push("Invalid latitude");
  }

  if (row.longitude !== null && (row.longitude < -180 || row.longitude > 180)) {
    errors.push("Invalid longitude");
  }

  return {
    row: index,
    valid: errors.length === 0,
    errors,
    data: row,
  };
}

export function validateBusinessRow(
  row: ReturnType<typeof normalizeBusinessRow>,
  index: number
) {
  const errors: string[] = [];

  if (!row.name) errors.push("Missing business name");
  if (!row.city) errors.push("Missing city");
  if (!row.category) errors.push("Missing category");

  if (row.category && !BUSINESS_CATEGORIES.has(row.category)) {
    errors.push(`Category not allowed: ${row.category}`);
  }

  if (row.website && !isValidUrl(row.website)) errors.push("Invalid website");
  if (row.maps_url && !isValidUrl(row.maps_url)) errors.push("Invalid maps_url");
  if (row.email && !isValidEmail(row.email)) errors.push("Invalid email");

  if (row.latitude !== null && (row.latitude < -90 || row.latitude > 90)) {
    errors.push("Invalid latitude");
  }

  if (row.longitude !== null && (row.longitude < -180 || row.longitude > 180)) {
    errors.push("Invalid longitude");
  }

  return {
    row: index,
    valid: errors.length === 0,
    errors,
    data: row,
  };
}


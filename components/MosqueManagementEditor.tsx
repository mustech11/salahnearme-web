"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

type Props = {
  mosque: {
    id: string;
    name: string | null;
    area: string | null;
    city: string | null;
    postcode: string | null;
    address: string | null;
    maps_url: string | null;
    jumuah_enabled: boolean | null;
    jumuah_khutbah_1: string | null;
    jumuah_salah_1: string | null;
    jumuah_khutbah_2: string | null;
    jumuah_salah_2: string | null;
    jumuah_khutbah_3: string | null;
    jumuah_salah_3: string | null;
    jumuah_notes: string | null;
  };

  prayerTimes: {
    fajr_start: string | null;
    sunrise: string | null;
    dhuhr_start: string | null;
    asr_start: string | null;
    maghrib_start: string | null;
    isha_start: string | null;
  } | null;
};

type FormState = {
  name: string;
  area: string;
  city: string;
  postcode: string;
  address: string;
  maps_url: string;

  jumuah_enabled: boolean;
  jumuah_khutbah_1: string;
  jumuah_salah_1: string;
  jumuah_khutbah_2: string;
  jumuah_salah_2: string;
  jumuah_khutbah_3: string;
  jumuah_salah_3: string;
  jumuah_notes: string;

  fajr_start: string;
  sunrise: string;
  dhuhr_start: string;
  asr_start: string;
  maghrib_start: string;
  isha_start: string;
};

type SaveState = "idle" | "saving" | "success" | "error";

type SaveResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

type ValidationErrors = Partial<Record<keyof FormState, string>>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const REQUEST_TIMEOUT_MS = 30_000;

const MAX_NAME_LENGTH = 180;
const MAX_AREA_LENGTH = 120;
const MAX_CITY_LENGTH = 120;
const MAX_POSTCODE_LENGTH = 20;
const MAX_ADDRESS_LENGTH = 500;
const MAX_MAPS_URL_LENGTH = 2_048;
const MAX_JUMUAH_NOTES_LENGTH = 2_000;

const DEFAULT_ERROR_MESSAGE =
  "The mosque settings could not be saved. Please try again.";

const TIME_FIELDS: ReadonlyArray<keyof Pick<
  FormState,
  | "jumuah_khutbah_1"
  | "jumuah_salah_1"
  | "jumuah_khutbah_2"
  | "jumuah_salah_2"
  | "jumuah_khutbah_3"
  | "jumuah_salah_3"
  | "fajr_start"
  | "sunrise"
  | "dhuhr_start"
  | "asr_start"
  | "maghrib_start"
  | "isha_start"
>> = [
  "jumuah_khutbah_1",
  "jumuah_salah_1",
  "jumuah_khutbah_2",
  "jumuah_salah_2",
  "jumuah_khutbah_3",
  "jumuah_salah_3",
  "fajr_start",
  "sunrise",
  "dhuhr_start",
  "asr_start",
  "maghrib_start",
  "isha_start",
];

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildInitialForm({
  mosque,
  prayerTimes,
}: Props): FormState {
  return {
    name: cleanString(mosque.name),
    area: cleanString(mosque.area),
    city: cleanString(mosque.city),
    postcode: cleanString(mosque.postcode),
    address: cleanString(mosque.address),
    maps_url: cleanString(mosque.maps_url),

    jumuah_enabled: mosque.jumuah_enabled === true,
    jumuah_khutbah_1: cleanString(mosque.jumuah_khutbah_1),
    jumuah_salah_1: cleanString(mosque.jumuah_salah_1),
    jumuah_khutbah_2: cleanString(mosque.jumuah_khutbah_2),
    jumuah_salah_2: cleanString(mosque.jumuah_salah_2),
    jumuah_khutbah_3: cleanString(mosque.jumuah_khutbah_3),
    jumuah_salah_3: cleanString(mosque.jumuah_salah_3),
    jumuah_notes: cleanString(mosque.jumuah_notes),

    fajr_start: cleanString(prayerTimes?.fajr_start),
    sunrise: cleanString(prayerTimes?.sunrise),
    dhuhr_start: cleanString(prayerTimes?.dhuhr_start),
    asr_start: cleanString(prayerTimes?.asr_start),
    maghrib_start: cleanString(prayerTimes?.maghrib_start),
    isha_start: cleanString(prayerTimes?.isha_start),
  };
}

function normaliseMapsUrl(value: string): string {
  const cleaned = value.trim();

  if (!cleaned) {
    return "";
  }

  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }

  return `https://${cleaned}`;
}

function validateMapsUrl(value: string): string {
  const cleaned = value.trim();

  if (!cleaned) {
    return "";
  }

  if (cleaned.length > MAX_MAPS_URL_LENGTH) {
    return `The maps URL must not exceed ${MAX_MAPS_URL_LENGTH.toLocaleString()} characters.`;
  }

  try {
    const parsed = new URL(normaliseMapsUrl(cleaned));

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return "Use a valid HTTP or HTTPS maps URL.";
    }

    if (!parsed.hostname) {
      return "Enter a valid maps URL.";
    }

    return "";
  } catch {
    return "Enter a valid maps URL.";
  }
}

function validateTime(value: string): string {
  const cleaned = value.trim();

  if (!cleaned) {
    return "";
  }

  return TIME_REGEX.test(cleaned)
    ? ""
    : "Use a valid 24-hour time.";
}

function validateForm(form: FormState): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!form.name.trim()) {
    errors.name = "Mosque name is required.";
  } else if (form.name.trim().length > MAX_NAME_LENGTH) {
    errors.name = `Mosque name must not exceed ${MAX_NAME_LENGTH} characters.`;
  }

  if (form.area.trim().length > MAX_AREA_LENGTH) {
    errors.area = `Area must not exceed ${MAX_AREA_LENGTH} characters.`;
  }

  if (form.city.trim().length > MAX_CITY_LENGTH) {
    errors.city = `City must not exceed ${MAX_CITY_LENGTH} characters.`;
  }

  if (form.postcode.trim().length > MAX_POSTCODE_LENGTH) {
    errors.postcode = `Postcode must not exceed ${MAX_POSTCODE_LENGTH} characters.`;
  }

  if (form.address.trim().length > MAX_ADDRESS_LENGTH) {
    errors.address = `Address must not exceed ${MAX_ADDRESS_LENGTH} characters.`;
  }

  const mapsError = validateMapsUrl(form.maps_url);

  if (mapsError) {
    errors.maps_url = mapsError;
  }

  if (
    form.jumuah_notes.trim().length >
    MAX_JUMUAH_NOTES_LENGTH
  ) {
    errors.jumuah_notes =
      `Jumu’ah notes must not exceed ${MAX_JUMUAH_NOTES_LENGTH.toLocaleString()} characters.`;
  }

  for (const field of TIME_FIELDS) {
    const timeError = validateTime(form[field]);

    if (timeError) {
      errors[field] = timeError;
    }
  }

  if (form.jumuah_enabled) {
    const hasJumuahSession = Boolean(
      form.jumuah_khutbah_1 ||
        form.jumuah_salah_1 ||
        form.jumuah_khutbah_2 ||
        form.jumuah_salah_2 ||
        form.jumuah_khutbah_3 ||
        form.jumuah_salah_3
    );

    if (!hasJumuahSession) {
      errors.jumuah_salah_1 =
        "Add at least one Jumu’ah khutbah or salah time while Jumu’ah management is enabled.";
    }
  }

  return errors;
}

function serialiseForm(form: FormState): string {
  return JSON.stringify(form);
}

function buildPayload(form: FormState): FormState {
  return {
    name: form.name.trim(),
    area: form.area.trim(),
    city: form.city.trim(),
    postcode: form.postcode.trim().toUpperCase(),
    address: form.address.trim(),
    maps_url: normaliseMapsUrl(form.maps_url),

    jumuah_enabled: form.jumuah_enabled,
    jumuah_khutbah_1: form.jumuah_khutbah_1.trim(),
    jumuah_salah_1: form.jumuah_salah_1.trim(),
    jumuah_khutbah_2: form.jumuah_khutbah_2.trim(),
    jumuah_salah_2: form.jumuah_salah_2.trim(),
    jumuah_khutbah_3: form.jumuah_khutbah_3.trim(),
    jumuah_salah_3: form.jumuah_salah_3.trim(),
    jumuah_notes: form.jumuah_notes.trim(),

    fajr_start: form.fajr_start.trim(),
    sunrise: form.sunrise.trim(),
    dhuhr_start: form.dhuhr_start.trim(),
    asr_start: form.asr_start.trim(),
    maghrib_start: form.maghrib_start.trim(),
    isha_start: form.isha_start.trim(),
  };
}

async function readSaveResponse(
  response: Response
): Promise<SaveResponse> {
  try {
    const value: unknown = await response.json();

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value as SaveResponse;
  } catch {
    return {};
  }
}

export default function MosqueManagementEditor({
  mosque,
  prayerTimes,
}: Props) {
  const router = useRouter();

  const statusId = useId();
  const formId = useId();

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const mountedRef = useRef(true);

  const initialForm = useMemo(
    () =>
      buildInitialForm({
        mosque,
        prayerTimes,
      }),
    [mosque, prayerTimes]
  );

  const [form, setForm] =
    useState<FormState>(initialForm);

  const [savedSnapshot, setSavedSnapshot] =
    useState(() => serialiseForm(initialForm));

  const [saveState, setSaveState] =
    useState<SaveState>("idle");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  const [showValidation, setShowValidation] =
    useState(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const nextForm = buildInitialForm({
      mosque,
      prayerTimes,
    });

    setForm(nextForm);
    setSavedSnapshot(serialiseForm(nextForm));
    setSaveState("idle");
    setMessage("");
    setErrorMessage("");
    setShowValidation(false);
  }, [mosque, prayerTimes]);

  const mosqueId = useMemo(
    () => cleanString(mosque.id),
    [mosque.id]
  );

  const validationErrors = useMemo(
    () => validateForm(form),
    [form]
  );

  const hasValidationErrors =
    Object.keys(validationErrors).length > 0;

  const hasUnsavedChanges =
    serialiseForm(form) !== savedSnapshot;

  const isSaving = saveState === "saving";

  const clearFeedback = useCallback(() => {
    setSaveState("idle");
    setMessage("");
    setErrorMessage("");
  }, []);

  const updateField = useCallback(
    <K extends keyof FormState>(
      key: K,
      value: FormState[K]
    ) => {
      setForm((current) => ({
        ...current,
        [key]: value,
      }));

      clearFeedback();
    },
    [clearFeedback]
  );

  const resetChanges = useCallback(() => {
    setForm(initialForm);
    setSavedSnapshot(serialiseForm(initialForm));
    setSaveState("idle");
    setMessage("");
    setErrorMessage("");
    setShowValidation(false);
  }, [initialForm]);

  const save = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setMessage("");
    setErrorMessage("");
    setShowValidation(true);

    if (!UUID_REGEX.test(mosqueId)) {
      setSaveState("error");
      setErrorMessage(
        "A valid mosque is required before settings can be saved."
      );
      return;
    }

    if (hasValidationErrors) {
      setSaveState("error");
      setErrorMessage(
        "Correct the highlighted fields before saving."
      );
      return;
    }

    if (!hasUnsavedChanges) {
      return;
    }

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let timedOut = false;

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setSaveState("saving");

    try {
      const payload = buildPayload(form);

      const response = await fetch(
        "/api/dashboard/mosque/save-settings",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({
            mosque_id: mosqueId,
            payload,
          }),
        }
      );

      const data = await readSaveResponse(response);

      if (!mountedRef.current) {
        return;
      }

      if (!response.ok || data.ok === false) {
        setSaveState("error");
        setErrorMessage(
          cleanString(data.error) ||
            cleanString(data.message) ||
            DEFAULT_ERROR_MESSAGE
        );
        return;
      }

      setForm(payload);
      setSavedSnapshot(serialiseForm(payload));
      setSaveState("success");
      setErrorMessage("");
      setMessage(
        cleanString(data.message) ||
          "Mosque settings saved successfully."
      );
      setShowValidation(false);

      router.refresh();
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setSaveState("error");

      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setErrorMessage(
          timedOut
            ? "The save request timed out. Please try again."
            : "The save request was cancelled."
        );
        return;
      }

      console.error(
        "Mosque management settings save failed:",
        error
      );

      setErrorMessage(DEFAULT_ERROR_MESSAGE);
    } finally {
      window.clearTimeout(timeoutId);

      if (
        abortControllerRef.current === controller
      ) {
        abortControllerRef.current = null;
      }

      if (mountedRef.current) {
        setSaveState((currentState) =>
          currentState === "saving"
            ? "idle"
            : currentState
        );
      }
    }
  }, [
    form,
    hasUnsavedChanges,
    hasValidationErrors,
    isSaving,
    mosqueId,
    router,
  ]);

  return (
    <form
      id={formId}
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      noValidate
    >
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
        <div className="text-xl font-semibold text-yellow-400">
          Mosque profile
        </div>

        <p className="mt-2 text-sm leading-6 text-white/60">
          Maintain the public name, address and map details shown
          on the mosque profile.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <TextField
            label="Mosque name"
            value={form.name}
            onChange={(value) =>
              updateField("name", value)
            }
            error={
              showValidation
                ? validationErrors.name
                : undefined
            }
            maxLength={MAX_NAME_LENGTH}
            required
            disabled={isSaving}
            autoComplete="organization"
          />

          <TextField
            label="Area"
            value={form.area}
            onChange={(value) =>
              updateField("area", value)
            }
            error={
              showValidation
                ? validationErrors.area
                : undefined
            }
            maxLength={MAX_AREA_LENGTH}
            disabled={isSaving}
            autoComplete="address-level3"
          />

          <TextField
            label="City"
            value={form.city}
            onChange={(value) =>
              updateField("city", value)
            }
            error={
              showValidation
                ? validationErrors.city
                : undefined
            }
            maxLength={MAX_CITY_LENGTH}
            disabled={isSaving}
            autoComplete="address-level2"
          />

          <TextField
            label="Postcode"
            value={form.postcode}
            onChange={(value) =>
              updateField("postcode", value)
            }
            error={
              showValidation
                ? validationErrors.postcode
                : undefined
            }
            maxLength={MAX_POSTCODE_LENGTH}
            disabled={isSaving}
            autoComplete="postal-code"
          />

          <TextField
            label="Address"
            value={form.address}
            onChange={(value) =>
              updateField("address", value)
            }
            error={
              showValidation
                ? validationErrors.address
                : undefined
            }
            maxLength={MAX_ADDRESS_LENGTH}
            disabled={isSaving}
            autoComplete="street-address"
            full
          />

          <TextField
            label="Maps URL"
            value={form.maps_url}
            onChange={(value) =>
              updateField("maps_url", value)
            }
            error={
              showValidation
                ? validationErrors.maps_url
                : undefined
            }
            maxLength={MAX_MAPS_URL_LENGTH}
            disabled={isSaving}
            inputMode="url"
            placeholder="https://maps.google.com/..."
            full
          />
        </div>
      </section>

      <section className="rounded-3xl border border-green-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xl font-semibold text-green-300">
              Jumu’ah management
            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
              Configure first, second and third Jumu’ah sessions
              so Friday prayer information remains accurate.
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm text-white/80">
            <input
              type="checkbox"
              checked={form.jumuah_enabled}
              onChange={(event) =>
                updateField(
                  "jumuah_enabled",
                  event.target.checked
                )
              }
              disabled={isSaving}
              className="size-4 rounded border-white/20 bg-black accent-green-500"
            />

            Enable Jumu’ah times
          </label>
        </div>

        <fieldset
          disabled={isSaving || !form.jumuah_enabled}
          className="mt-6"
        >
          <legend className="sr-only">
            Jumu’ah session times
          </legend>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TimeField
              label="1st Khutbah"
              value={form.jumuah_khutbah_1}
              onChange={(value) =>
                updateField(
                  "jumuah_khutbah_1",
                  value
                )
              }
              error={
                showValidation
                  ? validationErrors.jumuah_khutbah_1
                  : undefined
              }
            />

            <TimeField
              label="1st Salah"
              value={form.jumuah_salah_1}
              onChange={(value) =>
                updateField(
                  "jumuah_salah_1",
                  value
                )
              }
              error={
                showValidation
                  ? validationErrors.jumuah_salah_1
                  : undefined
              }
            />

            <TimeField
              label="2nd Khutbah"
              value={form.jumuah_khutbah_2}
              onChange={(value) =>
                updateField(
                  "jumuah_khutbah_2",
                  value
                )
              }
              error={
                showValidation
                  ? validationErrors.jumuah_khutbah_2
                  : undefined
              }
            />

            <TimeField
              label="2nd Salah"
              value={form.jumuah_salah_2}
              onChange={(value) =>
                updateField(
                  "jumuah_salah_2",
                  value
                )
              }
              error={
                showValidation
                  ? validationErrors.jumuah_salah_2
                  : undefined
              }
            />

            <TimeField
              label="3rd Khutbah"
              value={form.jumuah_khutbah_3}
              onChange={(value) =>
                updateField(
                  "jumuah_khutbah_3",
                  value
                )
              }
              error={
                showValidation
                  ? validationErrors.jumuah_khutbah_3
                  : undefined
              }
            />

            <TimeField
              label="3rd Salah"
              value={form.jumuah_salah_3}
              onChange={(value) =>
                updateField(
                  "jumuah_salah_3",
                  value
                )
              }
              error={
                showValidation
                  ? validationErrors.jumuah_salah_3
                  : undefined
              }
            />
          </div>

          <div className="mt-4">
            <TextareaField
              label="Jumu’ah notes"
              value={form.jumuah_notes}
              onChange={(value) =>
                updateField("jumuah_notes", value)
              }
              error={
                showValidation
                  ? validationErrors.jumuah_notes
                  : undefined
              }
              maxLength={MAX_JUMUAH_NOTES_LENGTH}
              rows={4}
              full
            />
          </div>
        </fieldset>

        {!form.jumuah_enabled ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
            Jumu’ah session fields are disabled. Existing values
            remain stored unless changed by the server.
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
        <div className="text-xl font-semibold text-yellow-400">
          City prayer times
        </div>

        <p className="mt-2 text-sm leading-6 text-white/70">
          These city-level beginning times support prayer-aware
          travel and location features.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TimeField
            label="Fajr"
            value={form.fajr_start}
            onChange={(value) =>
              updateField("fajr_start", value)
            }
            error={
              showValidation
                ? validationErrors.fajr_start
                : undefined
            }
            disabled={isSaving}
          />

          <TimeField
            label="Sunrise"
            value={form.sunrise}
            onChange={(value) =>
              updateField("sunrise", value)
            }
            error={
              showValidation
                ? validationErrors.sunrise
                : undefined
            }
            disabled={isSaving}
          />

          <TimeField
            label="Dhuhr"
            value={form.dhuhr_start}
            onChange={(value) =>
              updateField("dhuhr_start", value)
            }
            error={
              showValidation
                ? validationErrors.dhuhr_start
                : undefined
            }
            disabled={isSaving}
          />

          <TimeField
            label="Asr"
            value={form.asr_start}
            onChange={(value) =>
              updateField("asr_start", value)
            }
            error={
              showValidation
                ? validationErrors.asr_start
                : undefined
            }
            disabled={isSaving}
          />

          <TimeField
            label="Maghrib"
            value={form.maghrib_start}
            onChange={(value) =>
              updateField("maghrib_start", value)
            }
            error={
              showValidation
                ? validationErrors.maghrib_start
                : undefined
            }
            disabled={isSaving}
          />

          <TimeField
            label="Isha"
            value={form.isha_start}
            onChange={(value) =>
              updateField("isha_start", value)
            }
            error={
              showValidation
                ? validationErrors.isha_start
                : undefined
            }
            disabled={isSaving}
          />
        </div>
      </section>

      <div
        id={statusId}
        aria-live="polite"
        aria-atomic="true"
      >
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}

        {message ? (
          <div
            role="status"
            className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm leading-6 text-green-200"
          >
            {message}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={
            isSaving ||
            !hasUnsavedChanges ||
            (showValidation && hasValidationErrors)
          }
          aria-busy={isSaving}
          aria-describedby={statusId}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <span
                aria-hidden="true"
                className="mr-2 size-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
              />
              Saving...
            </>
          ) : saveState === "success" &&
            !hasUnsavedChanges ? (
            "Settings saved"
          ) : (
            "Save mosque settings"
          )}
        </button>

        <button
          type="button"
          onClick={resetChanges}
          disabled={isSaving || !hasUnsavedChanges}
          className="min-h-12 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset changes
        </button>

        {hasUnsavedChanges ? (
          <span className="text-xs font-semibold text-amber-300">
            Unsaved changes
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  full = false,
  error,
  htmlFor,
  required = false,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
  error?: string;
  htmlFor: string;
  required?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-medium text-white/80"
      >
        {label}

        {required ? (
          <span className="ml-1 text-red-300">*</span>
        ) : null}
      </label>

      {children}

      {error ? (
        <p className="mt-2 text-xs leading-5 text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  full = false,
  required = false,
  disabled = false,
  maxLength,
  placeholder,
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  full?: boolean;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "url";
}) {
  const inputId = useId();

  return (
    <Field
      label={label}
      htmlFor={inputId}
      full={full}
      error={error}
      required={required}
    >
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </Field>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  error,
  full = false,
  disabled = false,
  maxLength,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  full?: boolean;
  disabled?: boolean;
  maxLength?: number;
  rows: number;
}) {
  const inputId = useId();

  return (
    <Field
      label={label}
      htmlFor={inputId}
      full={full}
      error={error}
    >
      <textarea
        id={inputId}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        disabled={disabled}
        maxLength={maxLength}
        rows={rows}
        aria-invalid={Boolean(error)}
        className="w-full resize-y rounded-2xl border border-green-500/30 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400 focus:ring-1 focus:ring-green-400/40 disabled:cursor-not-allowed disabled:opacity-60"
      />

      {typeof maxLength === "number" ? (
        <div className="mt-2 text-right text-xs text-white/40">
          {value.length.toLocaleString()} /{" "}
          {maxLength.toLocaleString()}
        </div>
      ) : null}
    </Field>
  );
}

function TimeField({
  label,
  value,
  onChange,
  error,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const inputId = useId();

  return (
    <Field
      label={label}
      htmlFor={inputId}
      error={error}
    >
      <input
        id={inputId}
        type="time"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        disabled={disabled}
        step={60}
        aria-invalid={Boolean(error)}
        className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none transition focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </Field>
  );
}
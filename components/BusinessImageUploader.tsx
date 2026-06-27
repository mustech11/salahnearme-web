"use client";

import { useRef, useState } from "react";

import {
  uploadBusinessCover,
  uploadBusinessGalleryImage,
  uploadBusinessLogo,
} from "@/lib/supabaseStorage";

type Props = {
  businessId: string;
  currentLogo?: string | null;
  currentCover?: string | null;
  currentGallery?: string[] | null;
};

type MediaUpdatePayload = {
  business_id: string;
  logo_url?: string | null;
  cover_image_url?: string | null;
  gallery_urls?: string[];
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
};

const MAX_FILE_SIZE_MB = 5;
const MAX_GALLERY_IMAGES = 12;

function isValidImage(file: File) {
  return file.type.startsWith("image/");
}

function isValidFileSize(file: File) {
  return file.size <= MAX_FILE_SIZE_MB * 1024 * 1024;
}

async function readJsonSafely(res: Response): Promise<ApiResponse> {
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await res.text();

    return {
      ok: false,
      error: `Expected JSON but received ${
        contentType || "unknown response"
      }. First response text: ${text.slice(0, 140)}`,
    };
  }

  try {
    return (await res.json()) as ApiResponse;
  } catch {
    return {
      ok: false,
      error: "Server returned invalid JSON.",
    };
  }
}

async function updateBusinessMedia(payload: MediaUpdatePayload) {
  const res = await fetch("/api/business-dashboard/media", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data = await readJsonSafely(res);

  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Could not update business media.");
  }

  return data;
}

export default function BusinessImageUploader({
  businessId,
  currentLogo,
  currentCover,
  currentGallery = [],
}: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogo ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(currentCover ?? null);
  const [gallery, setGallery] = useState<string[]>(currentGallery ?? []);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  function resetMessages() {
    setMessage("");
    setErrorMessage("");
  }

  function validateFile(file: File) {
    if (!isValidImage(file)) {
      throw new Error("Please upload an image file.");
    }

    if (!isValidFileSize(file)) {
      throw new Error(`Image must be ${MAX_FILE_SIZE_MB}MB or smaller.`);
    }
  }

  async function uploadLogo(file: File) {
    try {
      resetMessages();
      validateFile(file);
      setLoading(true);

      const url = await uploadBusinessLogo(file, businessId);

      await updateBusinessMedia({
        business_id: businessId,
        logo_url: url,
      });

      setLogoUrl(url);
      setMessage("Logo updated successfully.");
    } catch (error) {
      console.error("Logo upload error:", error);

      setErrorMessage(
        error instanceof Error ? error.message : "Could not upload logo."
      );
    } finally {
      setLoading(false);

      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  }

  async function uploadCover(file: File) {
    try {
      resetMessages();
      validateFile(file);
      setLoading(true);

      const url = await uploadBusinessCover(file, businessId);

      await updateBusinessMedia({
        business_id: businessId,
        cover_image_url: url,
      });

      setCoverUrl(url);
      setMessage("Cover image updated successfully.");
    } catch (error) {
      console.error("Cover upload error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not upload cover image."
      );
    } finally {
      setLoading(false);

      if (coverInputRef.current) {
        coverInputRef.current.value = "";
      }
    }
  }

  async function uploadGallery(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    try {
      resetMessages();

      const selectedFiles = Array.from(files);

      if (gallery.length + selectedFiles.length > MAX_GALLERY_IMAGES) {
        throw new Error(
          `You can upload up to ${MAX_GALLERY_IMAGES} gallery images.`
        );
      }

      selectedFiles.forEach(validateFile);

      setLoading(true);

      const urls: string[] = [];

      for (const file of selectedFiles) {
        const url = await uploadBusinessGalleryImage(file, businessId);
        urls.push(url);
      }

      const updatedGallery = [...gallery, ...urls];

      await updateBusinessMedia({
        business_id: businessId,
        gallery_urls: updatedGallery,
      });

      setGallery(updatedGallery);
      setMessage("Gallery updated successfully.");
    } catch (error) {
      console.error("Gallery upload error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not upload gallery images."
      );
    } finally {
      setLoading(false);

      if (galleryInputRef.current) {
        galleryInputRef.current.value = "";
      }
    }
  }

  async function removeGalleryImage(imageUrl: string) {
    try {
      resetMessages();
      setLoading(true);

      const updatedGallery = gallery.filter((item) => item !== imageUrl);

      await updateBusinessMedia({
        business_id: businessId,
        gallery_urls: updatedGallery,
      });

      setGallery(updatedGallery);
      setMessage("Gallery image removed.");
    } catch (error) {
      console.error("Remove gallery image error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not remove gallery image."
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeLogo() {
    try {
      resetMessages();
      setLoading(true);

      await updateBusinessMedia({
        business_id: businessId,
        logo_url: null,
      });

      setLogoUrl(null);
      setMessage("Logo removed.");
    } catch (error) {
      console.error("Remove logo error:", error);

      setErrorMessage(
        error instanceof Error ? error.message : "Could not remove logo."
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeCover() {
    try {
      resetMessages();
      setLoading(true);

      await updateBusinessMedia({
        business_id: businessId,
        cover_image_url: null,
      });

      setCoverUrl(null);
      setMessage("Cover image removed.");
    } catch (error) {
      console.error("Remove cover error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not remove cover image."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
      <div className="mb-6">
        <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
          Business Media
        </div>

        <div className="mt-2 text-3xl font-black text-white">
          Images & Branding
        </div>

        <p className="mt-2 text-sm text-white/50">
          Upload a business logo, cover image, and gallery photos. Images should
          be clear, halal-appropriate, and no larger than {MAX_FILE_SIZE_MB}MB.
        </p>
      </div>

      {message ? (
        <div className="mb-5 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="mb-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-300">
          Uploading or saving media...
        </div>
      ) : null}

      <div className="space-y-10">
        <section>
          <div className="mb-3 text-lg font-bold text-white">Logo</div>

          {logoUrl ? (
            <div className="mb-4 flex flex-wrap items-end gap-4">
              <img
                src={logoUrl}
                alt="Business logo"
                className="h-28 w-28 rounded-2xl border border-yellow-500/20 object-cover"
              />

              <button
                type="button"
                onClick={removeLogo}
                disabled={loading}
                className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                Remove logo
              </button>
            </div>
          ) : (
            <div className="mb-4 rounded-2xl border border-dashed border-yellow-500/20 p-5 text-sm text-white/50">
              No logo uploaded yet.
            </div>
          )}

          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            disabled={loading}
            onChange={(e) => {
              const file = e.target.files?.[0];

              if (file) {
                uploadLogo(file);
              }
            }}
            className="block w-full text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-yellow-500 file:px-4 file:py-2 file:font-bold file:text-black hover:file:bg-yellow-400"
          />
        </section>

        <section>
          <div className="mb-3 text-lg font-bold text-white">Cover Image</div>

          {coverUrl ? (
            <div className="mb-4 space-y-4">
              <img
                src={coverUrl}
                alt="Business cover"
                className="h-48 w-full rounded-2xl border border-yellow-500/20 object-cover"
              />

              <button
                type="button"
                onClick={removeCover}
                disabled={loading}
                className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                Remove cover
              </button>
            </div>
          ) : (
            <div className="mb-4 rounded-2xl border border-dashed border-yellow-500/20 p-5 text-sm text-white/50">
              No cover image uploaded yet.
            </div>
          )}

          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            disabled={loading}
            onChange={(e) => {
              const file = e.target.files?.[0];

              if (file) {
                uploadCover(file);
              }
            }}
            className="block w-full text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-yellow-500 file:px-4 file:py-2 file:font-bold file:text-black hover:file:bg-yellow-400"
          />
        </section>

        <section>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-lg font-bold text-white">Gallery</div>

              <div className="text-sm text-white/50">
                {gallery.length}/{MAX_GALLERY_IMAGES} images uploaded.
              </div>
            </div>
          </div>

          {gallery.length > 0 ? (
            <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              {gallery.map((image) => (
                <div key={image} className="group relative">
                  <img
                    src={image}
                    alt="Business gallery"
                    className="h-32 w-full rounded-2xl border border-yellow-500/20 object-cover"
                  />

                  <button
                    type="button"
                    onClick={() => removeGalleryImage(image)}
                    disabled={loading}
                    className="absolute right-2 top-2 rounded-full bg-black/80 px-3 py-1 text-xs font-bold text-red-300 opacity-100 transition hover:bg-red-500/20 disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-4 rounded-2xl border border-dashed border-yellow-500/20 p-5 text-sm text-white/50">
              No gallery images uploaded yet.
            </div>
          )}

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={loading || gallery.length >= MAX_GALLERY_IMAGES}
            onChange={(e) => uploadGallery(e.target.files)}
            className="block w-full text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-yellow-500 file:px-4 file:py-2 file:font-bold file:text-black hover:file:bg-yellow-400 disabled:opacity-50"
          />
        </section>
      </div>
    </section>
  );
}


"use client";

import { useMemo, useRef, useState } from "react";

import {
  uploadBusinessCover,
  uploadBusinessGalleryImage,
  uploadBusinessLogo,
  uploadBusinessVideo,
} from "@/lib/supabaseStorage";

type MediaKind = "image" | "video";

type MediaCategory =
  | "logo"
  | "cover"
  | "menu"
  | "building"
  | "interior"
  | "facilities"
  | "food"
  | "team"
  | "advert"
  | "other";

type BusinessMediaItem = {
  id: string;
  kind: MediaKind;
  url: string;
  category: MediaCategory;
  label: string;
  featured?: boolean;
  uploaded_at: string;
};

type Props = {
  businessId: string;
  currentLogo?: string | null;
  currentCover?: string | null;
  currentGallery?: string[] | null;
  currentVideos?: string[] | null;
  currentMediaItems?: BusinessMediaItem[] | null;
};

type MediaUpdatePayload = {
  business_id: string;
  logo_url?: string | null;
  cover_image_url?: string | null;
  gallery_urls?: string[];
  video_urls?: string[];
  media_items?: BusinessMediaItem[];
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
};

const MAX_IMAGE_FILE_SIZE_MB = 5;
const MAX_VIDEO_FILE_SIZE_MB = 50;
const MAX_GALLERY_IMAGES = 12;
const MAX_VIDEOS = 4;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

const IMAGE_CATEGORIES: Array<{
  value: MediaCategory;
  label: string;
  hint: string;
}> = [
  {
    value: "menu",
    label: "Menu",
    hint: "Food menu, price list, specials, or offers.",
  },
  {
    value: "building",
    label: "Building",
    hint: "Outside view, shop front, entrance, or signage.",
  },
  {
    value: "interior",
    label: "Interior",
    hint: "Inside seating, shop layout, counters, or décor.",
  },
  {
    value: "facilities",
    label: "Facilities",
    hint: "Prayer space, family area, parking, toilets, or access.",
  },
  {
    value: "food",
    label: "Food / products",
    hint: "Meals, products, shelves, displays, or services.",
  },
  {
    value: "team",
    label: "Team",
    hint: "Staff photo or team presentation.",
  },
  {
    value: "other",
    label: "Other",
    hint: "General business media.",
  },
];

const VIDEO_CATEGORIES: Array<{
  value: MediaCategory;
  label: string;
  hint: string;
}> = [
  {
    value: "advert",
    label: "Short advert",
    hint: "A short promotional video for your listing.",
  },
  {
    value: "building",
    label: "Walk-through",
    hint: "Show the outside, inside, or customer experience.",
  },
  {
    value: "food",
    label: "Food / service preview",
    hint: "Show meals, products, or services.",
  },
  {
    value: "facilities",
    label: "Facilities",
    hint: "Show parking, seating, prayer area, or access.",
  },
];

function createMediaId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isValidImage(file: File) {
  return IMAGE_TYPES.includes(file.type);
}

function isValidVideo(file: File) {
  return VIDEO_TYPES.includes(file.type);
}

function bytesToMb(bytes: number) {
  return bytes / 1024 / 1024;
}

function cleanFileName(fileName: string) {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferCategory(file: File, kind: MediaKind): MediaCategory {
  const name = file.name.toLowerCase();

  if (kind === "video") {
    if (
      name.includes("ad") ||
      name.includes("advert") ||
      name.includes("promo") ||
      name.includes("promotion")
    ) {
      return "advert";
    }

    if (
      name.includes("walk") ||
      name.includes("tour") ||
      name.includes("inside") ||
      name.includes("interior")
    ) {
      return "building";
    }

    if (
      name.includes("food") ||
      name.includes("meal") ||
      name.includes("dish") ||
      name.includes("menu")
    ) {
      return "food";
    }

    return "advert";
  }

  if (name.includes("menu") || name.includes("price")) {
    return "menu";
  }

  if (
    name.includes("front") ||
    name.includes("outside") ||
    name.includes("building") ||
    name.includes("shop") ||
    name.includes("sign")
  ) {
    return "building";
  }

  if (
    name.includes("inside") ||
    name.includes("interior") ||
    name.includes("seating") ||
    name.includes("table")
  ) {
    return "interior";
  }

  if (
    name.includes("parking") ||
    name.includes("facility") ||
    name.includes("toilet") ||
    name.includes("prayer") ||
    name.includes("access")
  ) {
    return "facilities";
  }

  if (
    name.includes("food") ||
    name.includes("meal") ||
    name.includes("dish") ||
    name.includes("burger") ||
    name.includes("chicken") ||
    name.includes("meat")
  ) {
    return "food";
  }

  if (name.includes("team") || name.includes("staff")) {
    return "team";
  }

  return "other";
}

function makeLabel(file: File, category: MediaCategory) {
  const cleanName = cleanFileName(file.name);

  if (cleanName.length >= 3) {
    return cleanName.slice(0, 80);
  }

  const labels: Record<MediaCategory, string> = {
    logo: "Business logo",
    cover: "Business cover",
    menu: "Menu",
    building: "Building",
    interior: "Interior",
    facilities: "Facilities",
    food: "Food and products",
    team: "Team",
    advert: "Short advert",
    other: "Business media",
  };

  return labels[category];
}

function validateImage(file: File) {
  if (!isValidImage(file)) {
    throw new Error("Please upload JPG, PNG, WEBP, or GIF images only.");
  }

  if (bytesToMb(file.size) > MAX_IMAGE_FILE_SIZE_MB) {
    throw new Error(`Image must be ${MAX_IMAGE_FILE_SIZE_MB}MB or smaller.`);
  }
}

function validateVideo(file: File) {
  if (!isValidVideo(file)) {
    throw new Error("Please upload MP4, WEBM, or MOV videos only.");
  }

  if (bytesToMb(file.size) > MAX_VIDEO_FILE_SIZE_MB) {
    throw new Error(`Video must be ${MAX_VIDEO_FILE_SIZE_MB}MB or smaller.`);
  }
}

async function readJsonSafely(res: Response): Promise<ApiResponse> {
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await res.text();

    return {
      ok: false,
      error: `Expected JSON but received ${
        contentType || "unknown response"
      }. First response text: ${text.slice(0, 160)}`,
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

function buildInitialMediaItems(params: {
  currentGallery: string[];
  currentVideos: string[];
  currentMediaItems: BusinessMediaItem[];
}) {
  const existingUrls = new Set(params.currentMediaItems.map((item) => item.url));

  const galleryItems = params.currentGallery
    .filter((url) => !existingUrls.has(url))
    .map(
      (url): BusinessMediaItem => ({
        id: createMediaId(),
        kind: "image",
        url,
        category: "other",
        label: "Business gallery image",
        uploaded_at: new Date().toISOString(),
      })
    );

  const videoItems = params.currentVideos
    .filter((url) => !existingUrls.has(url))
    .map(
      (url): BusinessMediaItem => ({
        id: createMediaId(),
        kind: "video",
        url,
        category: "advert",
        label: "Business advert video",
        uploaded_at: new Date().toISOString(),
      })
    );

  return [...params.currentMediaItems, ...galleryItems, ...videoItems];
}

function categoryLabel(category: MediaCategory) {
  const all = [...IMAGE_CATEGORIES, ...VIDEO_CATEGORIES];
  return all.find((item) => item.value === category)?.label ?? "Media";
}

export default function BusinessImageUploader({
  businessId,
  currentLogo,
  currentCover,
  currentGallery = [],
  currentVideos = [],
  currentMediaItems = [],
}: Props) {
  const initialGallery = currentGallery ?? [];
  const initialVideos = currentVideos ?? [];
  const initialMediaItems = currentMediaItems ?? [];

  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogo ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(currentCover ?? null);
  const [gallery, setGallery] = useState<string[]>(initialGallery);
  const [videos, setVideos] = useState<string[]>(initialVideos);
  const [mediaItems, setMediaItems] = useState<BusinessMediaItem[]>(
    buildInitialMediaItems({
      currentGallery: initialGallery,
      currentVideos: initialVideos,
      currentMediaItems: initialMediaItems,
    })
  );

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const featuredMedia = useMemo(() => {
    return mediaItems.find((item) => item.featured) ?? null;
  }, [mediaItems]);

  const imageItems = mediaItems.filter((item) => item.kind === "image");
  const videoItems = mediaItems.filter((item) => item.kind === "video");

  function resetMessages() {
    setMessage("");
    setErrorMessage("");
  }

  async function persistMedia(nextMediaItems: BusinessMediaItem[]) {
    const nextGallery = nextMediaItems
      .filter((item) => item.kind === "image")
      .map((item) => item.url);

    const nextVideos = nextMediaItems
      .filter((item) => item.kind === "video")
      .map((item) => item.url);

    await updateBusinessMedia({
      business_id: businessId,
      gallery_urls: nextGallery,
      video_urls: nextVideos,
      media_items: nextMediaItems,
    });

    setGallery(nextGallery);
    setVideos(nextVideos);
    setMediaItems(nextMediaItems);
  }

  async function uploadLogo(file: File) {
    try {
      resetMessages();
      validateImage(file);
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
      validateImage(file);
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

      selectedFiles.forEach(validateImage);

      setLoading(true);

      const uploadedItems: BusinessMediaItem[] = [];

      for (const file of selectedFiles) {
        const url = await uploadBusinessGalleryImage(file, businessId);
        const category = inferCategory(file, "image");

        uploadedItems.push({
          id: createMediaId(),
          kind: "image",
          url,
          category,
          label: makeLabel(file, category),
          featured: mediaItems.length === 0 && uploadedItems.length === 0,
          uploaded_at: new Date().toISOString(),
        });
      }

      const nextMediaItems = [...mediaItems, ...uploadedItems];

      await persistMedia(nextMediaItems);

      setMessage(
        uploadedItems.length === 1
          ? "Gallery image uploaded successfully."
          : `${uploadedItems.length} gallery images uploaded successfully.`
      );
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

  async function uploadVideos(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    try {
      resetMessages();

      const selectedFiles = Array.from(files);

      if (videos.length + selectedFiles.length > MAX_VIDEOS) {
        throw new Error(`You can upload up to ${MAX_VIDEOS} short videos.`);
      }

      selectedFiles.forEach(validateVideo);

      setLoading(true);

      const uploadedItems: BusinessMediaItem[] = [];

      for (const file of selectedFiles) {
        const url = await uploadBusinessVideo(file, businessId);
        const category = inferCategory(file, "video");

        uploadedItems.push({
          id: createMediaId(),
          kind: "video",
          url,
          category,
          label: makeLabel(file, category),
          featured: mediaItems.length === 0 && uploadedItems.length === 0,
          uploaded_at: new Date().toISOString(),
        });
      }

      const nextMediaItems = [...mediaItems, ...uploadedItems];

      await persistMedia(nextMediaItems);

      setMessage(
        uploadedItems.length === 1
          ? "Video uploaded successfully."
          : `${uploadedItems.length} videos uploaded successfully.`
      );
    } catch (error) {
      console.error("Video upload error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not upload video media."
      );
    } finally {
      setLoading(false);

      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
    }
  }

  async function removeMediaItem(mediaId: string) {
    try {
      resetMessages();
      setLoading(true);

      const nextMediaItems = mediaItems.filter((item) => item.id !== mediaId);

      await persistMedia(nextMediaItems);

      setMessage("Media removed from listing.");
    } catch (error) {
      console.error("Remove media error:", error);

      setErrorMessage(
        error instanceof Error ? error.message : "Could not remove media."
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateMediaItem(
    mediaId: string,
    updates: Partial<Pick<BusinessMediaItem, "category" | "label" | "featured">>
  ) {
    try {
      resetMessages();
      setLoading(true);

      const nextMediaItems = mediaItems.map((item) => {
        if (item.id !== mediaId) {
          if (updates.featured) {
            return {
              ...item,
              featured: false,
            };
          }

          return item;
        }

        return {
          ...item,
          ...updates,
        };
      });

      await persistMedia(nextMediaItems);

      setMessage("Media details updated.");
    } catch (error) {
      console.error("Update media details error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update media details."
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
          Images, videos & smart listing media
        </div>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
          Upload your logo, cover image, menu, building photos, facilities,
          gallery images, and short advert videos. SalahNearMe will organise the
          media into useful listing sections using smart labels.
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

      <div className="grid gap-5 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.22em] text-yellow-400">
            Gallery
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {gallery.length}/{MAX_GALLERY_IMAGES}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.22em] text-yellow-400">
            Videos
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {videos.length}/{MAX_VIDEOS}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.22em] text-yellow-400">
            Featured
          </div>
          <div className="mt-2 truncate text-lg font-bold text-white">
            {featuredMedia ? featuredMedia.label : "Not selected"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.22em] text-yellow-400">
            Smart tags
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {new Set(mediaItems.map((item) => item.category)).size}
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-10">
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
                className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
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
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={loading}
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                uploadLogo(file);
              }
            }}
            className="block w-full text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-yellow-500 file:px-4 file:py-2 file:font-bold file:text-black hover:file:bg-yellow-400 disabled:opacity-50"
          />
        </section>

        <section>
          <div className="mb-3 text-lg font-bold text-white">Cover Image</div>

          {coverUrl ? (
            <div className="mb-4 space-y-4">
              <img
                src={coverUrl}
                alt="Business cover"
                className="h-56 w-full rounded-2xl border border-yellow-500/20 object-cover"
              />

              <button
                type="button"
                onClick={removeCover}
                disabled={loading}
                className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
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
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={loading}
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                uploadCover(file);
              }
            }}
            className="block w-full text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-yellow-500 file:px-4 file:py-2 file:font-bold file:text-black hover:file:bg-yellow-400 disabled:opacity-50"
          />
        </section>

        <section>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-lg font-bold text-white">
                Gallery Images
              </div>

              <div className="text-sm text-white/50">
                Upload menu, building, interior, facilities, food, products, or
                team photos.
              </div>
            </div>
          </div>

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            disabled={loading || gallery.length >= MAX_GALLERY_IMAGES}
            onChange={(event) => uploadGallery(event.target.files)}
            className="mb-5 block w-full text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-yellow-500 file:px-4 file:py-2 file:font-bold file:text-black hover:file:bg-yellow-400 disabled:opacity-50"
          />

          {imageItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {imageItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-yellow-500/20 bg-black/20 p-3"
                >
                  <img
                    src={item.url}
                    alt={item.label}
                    className="h-40 w-full rounded-xl object-cover"
                  />

                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                        {categoryLabel(item.category)}
                      </span>

                      {item.featured ? (
                        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300">
                          Featured
                        </span>
                      ) : null}
                    </div>

                    <input
                      value={item.label}
                      disabled={loading}
                      onChange={(event) => {
                        const nextLabel = event.target.value;

                        setMediaItems((items) =>
                          items.map((mediaItem) =>
                            mediaItem.id === item.id
                              ? {
                                  ...mediaItem,
                                  label: nextLabel,
                                }
                              : mediaItem
                          )
                        );
                      }}
                      onBlur={(event) =>
                        updateMediaItem(item.id, {
                          label: event.target.value.trim() || item.label,
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-yellow-400 disabled:opacity-50"
                    />

                    <select
                      value={item.category}
                      disabled={loading}
                      onChange={(event) =>
                        updateMediaItem(item.id, {
                          category: event.target.value as MediaCategory,
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-yellow-400 disabled:opacity-50"
                    >
                      {IMAGE_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          updateMediaItem(item.id, {
                            featured: true,
                          })
                        }
                        className="rounded-xl border border-yellow-500/30 px-3 py-2 text-xs font-bold text-yellow-300 transition hover:bg-yellow-500/10 disabled:opacity-50"
                      >
                        Set featured
                      </button>

                      <button
                        type="button"
                        onClick={() => removeMediaItem(item.id)}
                        disabled={loading}
                        className="rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-yellow-500/20 p-5 text-sm text-white/50">
              No gallery images uploaded yet.
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-lg font-bold text-white">
                Short Advert Videos
              </div>

              <div className="text-sm text-white/50">
                Upload up to {MAX_VIDEOS} videos. MP4, WEBM, or MOV. Maximum{" "}
                {MAX_VIDEO_FILE_SIZE_MB}MB each.
              </div>
            </div>
          </div>

          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            multiple
            disabled={loading || videos.length >= MAX_VIDEOS}
            onChange={(event) => uploadVideos(event.target.files)}
            className="mb-5 block w-full text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-yellow-500 file:px-4 file:py-2 file:font-bold file:text-black hover:file:bg-yellow-400 disabled:opacity-50"
          />

          {videoItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {videoItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-yellow-500/20 bg-black/20 p-3"
                >
                  <video
                    src={item.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-56 w-full rounded-xl bg-black object-cover"
                  />

                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                        {categoryLabel(item.category)}
                      </span>

                      {item.featured ? (
                        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300">
                          Featured
                        </span>
                      ) : null}
                    </div>

                    <input
                      value={item.label}
                      disabled={loading}
                      onChange={(event) => {
                        const nextLabel = event.target.value;

                        setMediaItems((items) =>
                          items.map((mediaItem) =>
                            mediaItem.id === item.id
                              ? {
                                  ...mediaItem,
                                  label: nextLabel,
                                }
                              : mediaItem
                          )
                        );
                      }}
                      onBlur={(event) =>
                        updateMediaItem(item.id, {
                          label: event.target.value.trim() || item.label,
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-yellow-400 disabled:opacity-50"
                    />

                    <select
                      value={item.category}
                      disabled={loading}
                      onChange={(event) =>
                        updateMediaItem(item.id, {
                          category: event.target.value as MediaCategory,
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-yellow-400 disabled:opacity-50"
                    >
                      {VIDEO_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          updateMediaItem(item.id, {
                            featured: true,
                          })
                        }
                        className="rounded-xl border border-yellow-500/30 px-3 py-2 text-xs font-bold text-yellow-300 transition hover:bg-yellow-500/10 disabled:opacity-50"
                      >
                        Set featured
                      </button>

                      <button
                        type="button"
                        onClick={() => removeMediaItem(item.id)}
                        disabled={loading}
                        className="rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-yellow-500/20 p-5 text-sm text-white/50">
              No advert videos uploaded yet.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
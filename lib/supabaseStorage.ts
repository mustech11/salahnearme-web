import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";

const supabaseStorage = createClient(
  publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const PUBLIC_BUCKETS = {
  logos: "business-logos",
  covers: "business-covers",
  gallery: "business-gallery",
  media: "business-media",
} as const;

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function getExtension(file: File, fallback = "bin") {
  const fromMime = IMAGE_EXTENSIONS[file.type] || VIDEO_EXTENSIONS[file.type];

  if (fromMime) {
    return fromMime;
  }

  const nameParts = file.name.split(".");
  const fromName = nameParts.length > 1 ? nameParts.pop() : null;

  return fromName?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || fallback;
}

function makePath(businessId: string, folder: string, file: File) {
  const cleanBusinessId = safeId(businessId);
  const extension = getExtension(file);
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);

  return `${cleanBusinessId}/${folder}/${timestamp}-${random}.${extension}`;
}

async function uploadPublicFile(params: {
  bucket: string;
  path: string;
  file: File;
}) {
  const { bucket, path, file } = params;

  const { error } = await supabaseStorage.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabaseStorage.storage.from(bucket).getPublicUrl(path);

  if (!data.publicUrl) {
    throw new Error("Could not generate public file URL.");
  }

  return data.publicUrl;
}

export async function uploadBusinessLogo(file: File, businessId: string) {
  return uploadPublicFile({
    bucket: PUBLIC_BUCKETS.logos,
    path: makePath(businessId, "logo", file),
    file,
  });
}

export async function uploadBusinessCover(file: File, businessId: string) {
  return uploadPublicFile({
    bucket: PUBLIC_BUCKETS.covers,
    path: makePath(businessId, "cover", file),
    file,
  });
}

export async function uploadBusinessGalleryImage(
  file: File,
  businessId: string
) {
  return uploadPublicFile({
    bucket: PUBLIC_BUCKETS.gallery,
    path: makePath(businessId, "gallery", file),
    file,
  });
}

export async function uploadBusinessVideo(file: File, businessId: string) {
  return uploadPublicFile({
    bucket: PUBLIC_BUCKETS.media,
    path: makePath(businessId, "videos", file),
    file,
  });
}
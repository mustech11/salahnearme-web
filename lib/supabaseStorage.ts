import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseStorageClient = createClient(supabaseUrl, supabaseAnonKey);

function getExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() || "png";
}

export async function uploadBusinessLogo(file: File, businessId: string) {
  const path = `${businessId}/${Date.now()}.${getExtension(file)}`;

  const { error } = await supabaseStorageClient.storage
    .from("business-logos")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) throw error;

  return supabaseStorageClient.storage.from("business-logos").getPublicUrl(path)
    .data.publicUrl;
}

export async function uploadBusinessCover(file: File, businessId: string) {
  const path = `${businessId}/${Date.now()}.${getExtension(file)}`;

  const { error } = await supabaseStorageClient.storage
    .from("business-covers")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) throw error;

  return supabaseStorageClient.storage.from("business-covers").getPublicUrl(path)
    .data.publicUrl;
}

export async function uploadBusinessGalleryImage(file: File, businessId: string) {
  const path = `${businessId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${getExtension(file)}`;

  const { error } = await supabaseStorageClient.storage
    .from("business-gallery")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) throw error;

  return supabaseStorageClient.storage.from("business-gallery").getPublicUrl(path)
    .data.publicUrl;
}


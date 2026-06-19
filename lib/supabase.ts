import { createClient } from "@supabase/supabase-js";

const BUCKET = "uploads";

function getClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

/** Supabase admin client with service key — bypasses RLS, has auth.admin API */
export function getAdminClient() {
  return getClient();
}

/** Sube un buffer a Supabase Storage y devuelve la URL pública */
export async function uploadFile(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const supabase = getClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/** Elimina un archivo de Supabase Storage */
export async function deleteFile(storagePath: string): Promise<void> {
  const supabase = getClient();
  await supabase.storage.from(BUCKET).remove([storagePath]);
}

/**
 * Extrae el storage path de una URL pública de Supabase
 * https://xxx.supabase.co/storage/v1/object/public/uploads/images/abc.jpg
 * → images/abc.jpg
 */
export function urlToStoragePath(publicUrl: string): string {
  const marker = `/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return publicUrl;
  return publicUrl.slice(idx + marker.length);
}

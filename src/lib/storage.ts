import { supabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

export type ImageBucket = 'startup-logos' | 'update-attachments' | 'mentor-photos';

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Must match storage.buckets.file_size_limit in supabase/migrations. */
export const MAX_IMAGE_BYTES: Record<ImageBucket, number> = {
  'startup-logos': 2 * 1024 * 1024,
  'update-attachments': 5 * 1024 * 1024,
  'mentor-photos': 2 * 1024 * 1024,
};

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** Returns an error message, or null when the file can be uploaded to `bucket`. */
export function validateImage(
  file: Pick<File, 'type' | 'size'>,
  bucket: ImageBucket,
): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Use a PNG, JPG or WebP image.';
  }
  const max = MAX_IMAGE_BYTES[bucket];
  if (file.size > max) return `Images must be ${Math.round(max / 1024 / 1024)} MB or smaller.`;
  if (file.size === 0) return 'That file is empty.';
  return null;
}

/** `<ownerFolder>/<prefix>-<random>.<ext>` — the folder is what storage RLS checks. */
export function storagePath(ownerFolder: string, prefix: string, file: Pick<File, 'type'>): string {
  const extension = EXTENSIONS[file.type] ?? 'bin';
  return `${ownerFolder}/${prefix}-${crypto.randomUUID()}.${extension}`;
}

/**
 * Uploads with progress events (supabase-js upload has none). Uses the signed-in
 * user's access token, so storage RLS applies exactly as for supabase-js.
 */
export async function uploadWithProgress(
  bucket: ImageBucket,
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You need to be signed in to upload files.');
  const { supabaseUrl, supabaseAnonKey } = getEnv();
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`);
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.setRequestHeader('apikey', supabaseAnonKey);
    request.setRequestHeader('Content-Type', file.type);
    request.setRequestHeader('x-upsert', 'false');
    request.setRequestHeader('cache-control', 'max-age=3600');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.((event.loaded / event.total) * 100);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(uploadErrorMessage(request.status)));
      }
    };
    request.onerror = () =>
      reject(new Error('Upload failed. Check your connection and try again.'));
    request.send(file);
  });
  return path;
}

function uploadErrorMessage(status: number): string {
  if (status === 413) return 'That image is too large.';
  if (status === 415) return 'That file type is not allowed.';
  if (status === 401 || status === 403) return "You don't have permission to upload here.";
  return 'Upload failed. Please try again.';
}

export async function removeFile(
  bucket: ImageBucket,
  path: string | null | undefined,
): Promise<void> {
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]);
}

/** Public URL for files in public buckets (logos, mentor photos). */
export function publicFileUrl(
  bucket: 'startup-logos' | 'mentor-photos',
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function createSignedUrl(bucket: 'update-attachments', path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

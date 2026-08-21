import { supabaseClient } from '@/lib/db/supabase';

/**
 * Recipe photography.
 *
 * The app does not generate images — it generates a prompt. This is the other half
 * of that loop: bring the resulting photo back in.
 *
 * Images are downscaled and re-encoded before they are stored. On the local store
 * they become data URLs living in localStorage, which has a hard quota measured in
 * single-digit megabytes, so the size ceiling here is not cosmetic.
 */

export const BUCKET = 'recipe-images';

const MAX_EDGE = 1100;
const TARGET_BYTES = 320 * 1024;
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.5];

export class ImageTooLargeError extends Error {
  constructor() {
    super('Could not compress that image far enough to store it.');
  }
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // honours EXIF rotation, which phone photos rely on
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Downscale, square-ish crop preserved, re-encode as JPEG under the size ceiling. */
export async function compressImage(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  const source = await decode(file);
  const w = 'width' in source ? source.width : 0;
  const h = 'height' in source ? source.height : 0;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  if ('close' in source) source.close();

  for (const quality of QUALITY_STEPS) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) continue;
    if (blob.size <= TARGET_BYTES || quality === QUALITY_STEPS[QUALITY_STEPS.length - 1]) {
      return { blob, dataUrl: await blobToDataUrl(blob) };
    }
  }
  throw new ImageTooLargeError();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not encode that image.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Store a recipe photo and return the URL to save on the recipe.
 * Supabase Storage when configured, an inline data URL otherwise.
 */
export async function storeRecipeImage(recipeId: string, file: File): Promise<string> {
  const { blob, dataUrl } = await compressImage(file);

  const db = supabaseClient();
  if (!db) return dataUrl;

  const path = `${recipeId}-${Date.now()}.jpg`;
  const { error } = await db.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Best-effort cleanup; a missing remote object is not an error worth surfacing. */
export async function removeRecipeImage(imageUrl: string | null): Promise<void> {
  if (!imageUrl || imageUrl.startsWith('data:')) return;
  const db = supabaseClient();
  if (!db) return;
  const marker = `/${BUCKET}/`;
  const i = imageUrl.indexOf(marker);
  if (i === -1) return;
  await db.storage.from(BUCKET).remove([imageUrl.slice(i + marker.length)]);
}

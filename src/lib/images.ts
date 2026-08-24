import { getRepo } from '@/lib/db';

/**
 * Recipe photography.
 *
 * The app does not generate images — it generates a prompt. This is the other half
 * of that loop: bring the resulting photo back in.
 *
 * Images are downscaled and re-encoded before they leave here. The ceiling is not
 * cosmetic: a photo taken with no signal waits in the device mirror until the queue
 * drains, and a phone's storage budget is not a place to park 4 MB camera output.
 */

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
export async function compressImage(file: File): Promise<Blob> {
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
      return blob;
    }
  }
  throw new ImageTooLargeError();
}

/**
 * Store a recipe photo and return the URL to save on the recipe.
 *
 * With a connection that is a public Storage URL. Without one it is an `idb:`
 * sentinel backed by the blob sitting in the outbox, which the flush replaces with
 * the real URL later. The caller cannot tell the difference and does not need to.
 */
export async function storeRecipeImage(recipeId: string, file: File): Promise<string> {
  return getRepo().storeImage(recipeId, await compressImage(file));
}

/** Best-effort cleanup; a missing remote object is not an error worth surfacing. */
export async function removeRecipeImage(imageUrl: string | null): Promise<void> {
  return getRepo().removeImage(imageUrl);
}

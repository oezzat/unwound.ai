// Browser-side photo preparation, shared by both apps.
// Every photo is re-drawn onto a canvas and re-encoded as JPEG: this applies the camera's rotation, caps the size
// (upload time on rural connections, storage), and drops ALL metadata (EXIF incl. GPS location) before it leaves the device.
// The server strips metadata again and never trusts this step.

export interface PreparedPhoto { blob: Blob; width: number; height: number; previewUrl: string }

export async function preparePhoto(file: File, maxDim = 1600, quality = 0.82): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a photo.");
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any).catch(() => null);
  if (!bmp) throw new Error("That photo format isn't supported. Please take a new photo.");
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale), height = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the photo on this device.");
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close?.();
  const blob: Blob | null = await new Promise(r => canvas.toBlob(r, "image/jpeg", quality));
  if (!blob) throw new Error("Couldn't process the photo on this device.");
  return { blob, width, height, previewUrl: URL.createObjectURL(blob) };
}

/** Authenticated image → object URL, cached per path for the session. */
const cache = new Map<string, Promise<string>>();
export function loadImageUrl(fetchBlob: (path: string) => Promise<Blob>, path: string): Promise<string> {
  let p = cache.get(path);
  if (!p) { p = fetchBlob(path).then(b => URL.createObjectURL(b)); p.catch(() => cache.delete(path)); cache.set(path, p); }
  return p;
}
export const clearImageCache = () => { cache.forEach(p => p.then(u => URL.revokeObjectURL(u)).catch(() => {})); cache.clear(); };

// Shared client-side image downscaling for anywhere a screenshot gets
// base64-encoded before being sent to the backend (the "Report Feedback"
// dialog's screenshots, a reply-thread's attached image) — this app has no
// object storage, so an attachment is always a data: URL; downsizing it
// first keeps that string (and the eventual Postgres row) from ballooning
// on an untouched full-resolution monitor screenshot.

const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_JPEG_QUALITY = 0.85;

export async function downscaleImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  // Non-raster formats (e.g. an SVG someone pasted) — pass through as-is
  // rather than fighting the canvas over something it can't usefully resize.
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return dataUrl;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = dataUrl;
  });

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", IMAGE_JPEG_QUALITY);
}

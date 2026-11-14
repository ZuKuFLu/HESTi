/**
 * Browser-side image shrinking.
 *
 * Vercel caps a request body at roughly 4.5 MB and a phone photo of a
 * contractor's quote is easily bigger than that, so photos are resized before
 * they ever leave the browser. PDFs are sent untouched.
 */

const MAX_EDGE_PX = 2000;
const JPEG_QUALITY = 0.85;

export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function isAcceptedFile(file: File): boolean {
  return (ACCEPTED_FILE_TYPES as readonly string[]).includes(file.type);
}

/**
 * Returns a file small enough to upload. Anything that isn't an image, or that
 * fails to decode, is returned unchanged so the server can decide about it.
 */
export async function prepareFileForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return file;

    // If shrinking somehow made it bigger, keep the original.
    if (blob.size >= file.size && scale === 1) return file;

    return new File([blob], replaceExtension(file.name, "jpg"), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

function replaceExtension(name: string, extension: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${extension}`;
}

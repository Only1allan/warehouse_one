/** Shrinks a photo in the browser so the longest edge is at most maxEdge pixels (JPEG). */
export async function resizeImage(file: Blob, maxEdge: number, quality = 0.88): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.type === "image/jpeg") {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare the photo."))), "image/jpeg", quality),
  );
}

export const DOCUMENT_MAX_EDGE = 1280;
export const VISION_MAX_EDGE = 512;

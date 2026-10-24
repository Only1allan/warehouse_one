import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AppError } from "../errors";

export const UPLOAD_ROOT_ENV = "WAREHOUSE_UPLOAD_DIR";
const PATH_PATTERN = /^uploads\/counts\/[a-f0-9-]{36}\.(jpg|png|webp)$/;

export function uploadRoot(): string {
  return process.env[UPLOAD_ROOT_ENV] ?? path.join(process.cwd(), "data");
}

export function sniffImage(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (
    bytes.length > 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function isValidUploadPath(value: string): boolean {
  return PATH_PATTERN.test(value);
}

export function saveCountPhoto(bytes: Uint8Array): string {
  const ext = sniffImage(bytes);
  if (!ext) throw new AppError("invalid_request", "That file is not a photo. Use a JPG, PNG or WebP image.");
  const relative = `uploads/counts/${randomUUID()}.${ext}`;
  const file = path.join(uploadRoot(), relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return relative;
}

export function readUpload(relative: string): { bytes: Buffer; contentType: string } {
  if (!isValidUploadPath(relative)) throw new AppError("not_found", "Photo not found.", 404);
  const file = path.join(uploadRoot(), relative);
  if (!fs.existsSync(file)) throw new AppError("not_found", "Photo not found.", 404);
  const ext = relative.split(".").pop();
  return {
    bytes: fs.readFileSync(file),
    contentType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
  };
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { confirmCount } from "@/lib/services/counting";
import { isValidUploadPath, readUpload, saveCountPhoto, sniffImage, UPLOAD_ROOT_ENV } from "@/lib/services/uploads";
import { FIXED_NOW, freshDb } from "./helpers";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "wh-uploads-"));
  process.env[UPLOAD_ROOT_ENV] = dir;
});
afterAll(() => {
  delete process.env[UPLOAD_ROOT_ENV];
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("photo uploads", () => {
  it("recognises images by their first bytes, not by file name", () => {
    expect(sniffImage(png)).toBe("png");
    expect(sniffImage(jpg)).toBe("jpg");
    expect(sniffImage(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
  });

  it("saves a photo under a generated name and reads it back", () => {
    const relative = saveCountPhoto(png);
    expect(isValidUploadPath(relative)).toBe(true);
    const { bytes, contentType } = readUpload(relative);
    expect(contentType).toBe("image/png");
    expect(new Uint8Array(bytes)).toEqual(png);
  });

  it("rejects something that is not an image", () => {
    expect(() => saveCountPhoto(new TextEncoder().encode("not an image at all"))).toThrow(/not a photo/);
  });

  it.each(["../../etc/passwd", "uploads/counts/../../secret.png", "uploads/counts/abc.png", "/etc/passwd", "uploads/other/x.png"])(
    "refuses the unsafe path %j",
    (p) => {
      expect(isValidUploadPath(p)).toBe(false);
      expect(() => readUpload(p)).toThrow(/not found/i);
    },
  );

  it("only accepts a valid photo reference when a count is confirmed", () => {
    const db = freshDb();
    const base = { sku: "200310", locationId: "A-2-1", confirmedQty: 31, operatorId: "o-amina", shiftId: "s-morning" };
    expect(() => confirmCount(db, { now: FIXED_NOW }, { ...base, photoPath: "../../etc/passwd" })).toThrow(/photo reference/);
    const relative = saveCountPhoto(jpg);
    expect(confirmCount(db, { now: FIXED_NOW }, { ...base, photoPath: relative }).photoPath).toBe(relative);
  });
});

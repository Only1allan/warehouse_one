import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 32;
const hashCache = new Map<string, string>();

/** Returns "salt:hash" (hex). A fixed salt is only used for seeded demo accounts, so reseeds are repeatable. */
export function hashPassword(password: string, salt: string = randomBytes(16).toString("hex")): string {
  const cacheKey = `${salt}:${password}`;
  const cached = hashCache.get(cacheKey);
  if (cached) return cached;
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  const stored = `${salt}:${hash}`;
  if (hashCache.size < 64) hashCache.set(cacheKey, stored);
  return stored;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

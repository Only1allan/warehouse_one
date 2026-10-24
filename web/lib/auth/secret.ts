import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const globalForSecret = globalThis as unknown as { __sessionSecret?: string };

/** The signing key for session cookies. Set SESSION_SECRET, or one is created once on this device. */
export function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (globalForSecret.__sessionSecret) return globalForSecret.__sessionSecret;
  const file = path.join(process.cwd(), "data", ".session-secret");
  let secret: string;
  if (fs.existsSync(file)) {
    secret = fs.readFileSync(file, "utf8").trim();
  } else {
    secret = randomBytes(32).toString("hex");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
  }
  globalForSecret.__sessionSecret = secret;
  return secret;
}

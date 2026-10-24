import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionPayload {
  uid: string;
  sid: string;
  exp: number;
}

export const SESSION_COOKIE = "wh_session";
export const SESSION_HOURS = 12;

const b64 = (input: string | Buffer) => Buffer.from(input).toString("base64url");

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function createSessionToken(
  payload: { uid: string; sid: string },
  secret: string,
  now: Date,
  hours: number = SESSION_HOURS,
): string {
  const full: SessionPayload = { ...payload, exp: now.getTime() + hours * 3_600_000 };
  const body = b64(JSON.stringify(full));
  return `${body}.${sign(body, secret)}`;
}

/** Returns the payload only when the signature is valid and the token has not expired. */
export function verifySessionToken(token: string | undefined | null, secret: string, now: Date): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.uid !== "string" || typeof payload.sid !== "string" || typeof payload.exp !== "number") return null;
    return payload.exp > now.getTime() ? payload : null;
  } catch {
    return null;
  }
}

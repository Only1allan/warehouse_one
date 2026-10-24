import { connection } from "next/server";
import type { Capability } from "./auth/capabilities";
import { requireAuth, type AuthContext } from "./auth/server";
import type { Db } from "./db";
import { getSeededDb } from "./db/runtime";
import { AppError, errorResponse } from "./errors";

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError("invalid_request", "The request body must be valid JSON.");
  }
}

export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    await connection();
    return await fn();
  } catch (error) {
    return errorResponse(error);
  }
}

export interface AuthedContext extends AuthContext {
  db: Db;
  now: Date;
}

/** Wraps a route so it needs a valid session, and (optionally) a role capability. */
export async function handleAuthed(
  capability: Capability | null,
  fn: (ctx: AuthedContext) => Promise<Response> | Response,
): Promise<Response> {
  return handle(async () => {
    const db = getSeededDb();
    const auth = await requireAuth(db, capability);
    return fn({ ...auth, db, now: new Date() });
  });
}

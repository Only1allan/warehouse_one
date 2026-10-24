import { cookies } from "next/headers";
import type { Db } from "../db";
import { AppError } from "../errors";
import { getUserById, isValidShift, type AuthUser } from "../services/auth";
import { can, type Capability } from "./capabilities";
import { getSessionSecret } from "./secret";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_HOURS,
  verifySessionToken,
} from "./session-token";

export interface AuthContext {
  user: AuthUser;
  shiftId: string;
}

export async function startSession(user: AuthUser, shiftId: string): Promise<void> {
  const token = createSessionToken({ uid: user.id, sid: shiftId }, getSessionSecret(), new Date());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
    secure: false,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(db: Db): Promise<AuthContext | null> {
  const store = await cookies();
  const payload = verifySessionToken(store.get(SESSION_COOKIE)?.value, getSessionSecret(), new Date());
  if (!payload) return null;
  const user = getUserById(db, payload.uid);
  if (!user) return null;
  return { user, shiftId: isValidShift(db, payload.sid) ? payload.sid : "s-morning" };
}

export async function requireAuth(db: Db, capability?: Capability | null): Promise<AuthContext> {
  const session = await readSession(db);
  if (!session) throw new AppError("unauthenticated", "Sign in to continue.", 401);
  if (capability && !can(session.user.role, capability)) {
    throw new AppError("forbidden", "Your role cannot do this.", 403);
  }
  return session;
}

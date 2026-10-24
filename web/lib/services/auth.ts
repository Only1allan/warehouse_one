import type { Db } from "../db";
import { DEMO_ACCOUNTS, FEATURED_USERNAMES } from "../auth/demo-accounts";
import { hashPassword, verifyPassword } from "../auth/password";
import { isRole, ROLE_TITLES, type Role } from "../auth/capabilities";
import { AppError } from "../errors";
import { shiftForDate } from "../time";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  title: string;
}

const DUMMY_HASH = hashPassword("not-a-real-password", "dummy-salt");

function toUser(row: { id: string; name: string; username: string; role: string }): AuthUser {
  if (!isRole(row.role)) throw new AppError("invalid_request", "Unknown role", 500);
  return { id: row.id, name: row.name, username: row.username, role: row.role, title: ROLE_TITLES[row.role] };
}

export function getUserById(db: Db, id: string): AuthUser | null {
  const row = db
    .prepare("SELECT id, name, username, role FROM operators WHERE id = ?")
    .get(id) as { id: string; name: string; username: string; role: string } | undefined;
  return row ? toUser(row) : null;
}

export function signIn(
  db: Db,
  input: { username: string; password: string; shiftId?: string },
  now: Date,
): { user: AuthUser; shiftId: string } {
  const username = (input.username ?? "").trim().toLowerCase();
  const row = db
    .prepare("SELECT id, name, username, role, password_hash FROM operators WHERE username = ?")
    .get(username) as
    | { id: string; name: string; username: string; role: string; password_hash: string }
    | undefined;
  const ok = verifyPassword(String(input.password ?? ""), row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    throw new AppError("invalid_credentials", "Wrong username or password.", 401);
  }
  const shiftOk = input.shiftId
    ? db.prepare("SELECT 1 FROM shifts WHERE id = ?").get(input.shiftId)
    : null;
  return { user: toUser(row), shiftId: shiftOk ? input.shiftId! : shiftForDate(now).id };
}

export function listShifts(db: Db): Array<{ id: string; name: string; startHour: number; endHour: number }> {
  return (
    db.prepare("SELECT id, name, start_hour, end_hour FROM shifts ORDER BY start_hour").all() as Array<{
      id: string;
      name: string;
      start_hour: number;
      end_hour: number;
    }>
  ).map((s) => ({ id: s.id, name: s.name, startHour: s.start_hour, endHour: s.end_hour }));
}

export function isValidShift(db: Db, shiftId: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM shifts WHERE id = ?").get(shiftId));
}

export interface DemoLogin {
  username: string;
  password: string;
  name: string;
  role: Role;
  title: string;
  featured: boolean;
}

export function demoLoginsEnabled(): boolean {
  return process.env.DEMO_ACCOUNTS !== "off";
}

export function listDemoLogins(): DemoLogin[] {
  if (!demoLoginsEnabled()) return [];
  return DEMO_ACCOUNTS.map((a) => ({
    username: a.username,
    password: a.password,
    name: a.name,
    role: a.role,
    title: ROLE_TITLES[a.role],
    featured: FEATURED_USERNAMES.includes(a.username),
  }));
}

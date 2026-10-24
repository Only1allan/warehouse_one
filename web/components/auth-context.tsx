"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { can, type Capability } from "@/lib/auth/capabilities";
import type { AuthUser } from "@/lib/services/auth";

export interface ShiftOption {
  id: string;
  name: string;
  startHour: number;
  endHour: number;
}

interface AuthState {
  status: "loading" | "ready";
  user: AuthUser | null;
  shiftId: string | null;
  shifts: ShiftOption[];
  can: (capability: Capability) => boolean;
  signIn: (username: string, password: string, shiftId?: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  setShift: (shiftId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

async function post(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? "Something went wrong.");
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/me");
    const data = await response.json();
    setUser(data.user);
    setShiftId(data.shiftId);
    setShifts(data.shifts ?? []);
    setStatus("ready");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (username: string, password: string, chosenShift?: string) => {
      const data = await post("/api/auth/signin", { username, password, shiftId: chosenShift });
      setUser(data.user);
      setShiftId(data.shiftId);
      return data.user as AuthUser;
    },
    [],
  );

  const signOut = useCallback(async () => {
    await post("/api/auth/signout");
    setUser(null);
    setShiftId(null);
  }, []);

  const setShift = useCallback(async (next: string) => {
    await post("/api/auth/shift", { shiftId: next });
    setShiftId(next);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      shiftId,
      shifts,
      can: (capability) => (user ? can(user.role, capability) : false),
      signIn,
      signOut,
      setShift,
      refresh,
    }),
    [status, user, shiftId, shifts, signIn, signOut, setShift, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

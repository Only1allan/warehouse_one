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
import type { SessionOptions } from "@/lib/services/session";

interface OperatorState {
  ready: boolean;
  options: SessionOptions | null;
  operatorId: string | null;
  shiftId: string | null;
  setOperatorId: (id: string) => void;
  setShiftId: (id: string) => void;
}

const STORAGE_KEY = "wh-copilot-session";
const Ctx = createContext<OperatorState | null>(null);

export function OperatorProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<SessionOptions | null>(null);
  const [operatorId, setOperatorIdState] = useState<string | null>(null);
  const [shiftId, setShiftIdState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/session");
      const data = (await response.json()) as SessionOptions;
      if (cancelled) return;
      let saved: { operatorId?: string; shiftId?: string } = {};
      try {
        saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      } catch {
        saved = {};
      }
      const operator = data.operators.some((o) => o.id === saved.operatorId)
        ? saved.operatorId!
        : data.operators[0].id;
      const shift = data.shifts.some((s) => s.id === saved.shiftId)
        ? saved.shiftId!
        : data.currentShiftId;
      setOptions(data);
      setOperatorIdState(operator);
      setShiftIdState(shift);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((operator: string | null, shift: string | null) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ operatorId: operator, shiftId: shift }),
    );
  }, []);

  const setOperatorId = useCallback(
    (id: string) => {
      setOperatorIdState(id);
      persist(id, shiftId);
    },
    [persist, shiftId],
  );
  const setShiftId = useCallback(
    (id: string) => {
      setShiftIdState(id);
      persist(operatorId, id);
    },
    [persist, operatorId],
  );

  const value = useMemo<OperatorState>(
    () => ({
      ready: options !== null,
      options,
      operatorId,
      shiftId,
      setOperatorId,
      setShiftId,
    }),
    [options, operatorId, shiftId, setOperatorId, setShiftId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOperator(): OperatorState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useOperator must be used inside OperatorProvider");
  return value;
}

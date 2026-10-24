export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export interface ShiftWindow {
  id: string;
  name: string;
  startHour: number;
  endHour: number;
}

export const SHIFTS: ShiftWindow[] = [
  { id: "s-morning", name: "Morning", startHour: 6, endHour: 14 },
  { id: "s-afternoon", name: "Afternoon", startHour: 14, endHour: 22 },
  { id: "s-night", name: "Night", startHour: 22, endHour: 6 },
];

export function shiftForDate(date: Date): ShiftWindow {
  const hour = date.getHours();
  if (hour >= 6 && hour < 14) return SHIFTS[0];
  if (hour >= 14 && hour < 22) return SHIFTS[1];
  return SHIFTS[2];
}

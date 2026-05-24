/**
 * Spaced-revision (SM-2 lite) scheduling layered on top of the existing
 * mistake bank in src/hooks/useProgress.ts. We don't replace the storage —
 * we just enrich each mistake with a `streak` and `nextDueAt`.
 */
import { loadMistakes, type StoredMistake } from "@/hooks/useProgress";

const DAY = 86_400_000;
// streak index (0,1,2,3,4+) -> days until next review
const SCHEDULE = [0, 1, 3, 7, 16];

export function nextDueAfter(streak: number, now = Date.now()): number {
  const idx = Math.min(streak, SCHEDULE.length - 1);
  return now + SCHEDULE[idx] * DAY;
}

export function isDue(m: StoredMistake, now = Date.now()): boolean {
  const due = (m as StoredMistake & { nextDueAt?: number }).nextDueAt;
  return due === undefined || due <= now;
}

export function dueMistakes(): StoredMistake[] {
  return loadMistakes().filter((m) => isDue(m));
}

export function dueCount(): number {
  if (typeof window === "undefined") return 0;
  return dueMistakes().length;
}

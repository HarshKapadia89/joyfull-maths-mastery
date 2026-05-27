import type { ProgressState } from "./useProgress";

const STORAGE_KEY = "hbk-maths-progress-v1";

export function loadProgressRaw(): ProgressState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProgressState;
  } catch {
    return null;
  }
}

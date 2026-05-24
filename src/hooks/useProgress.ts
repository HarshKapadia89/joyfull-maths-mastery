import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "hbk-maths-progress-v1";

export type ChapterProgress = {
  best: number; // best score out of total
  total: number; // total questions
  stars: 0 | 1 | 2 | 3;
  attempts: number;
};

export type ProgressState = {
  chapters: Record<string, ChapterProgress>; // key = `${grade}-${chapterId}`
  totalStars: number;
  conceptStars: number; // earned via tutor explorations
  xp: number;
  streak: number;
  lastPlayed: string | null; // YYYY-MM-DD
  lastDaily: string | null;
};

const initial: ProgressState = {
  chapters: {},
  totalStars: 0,
  conceptStars: 0,
  xp: 0,
  streak: 0,
  lastPlayed: null,
  lastDaily: null,
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadProgress(): ProgressState {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    return { ...initial, ...(JSON.parse(raw) as ProgressState) };
  } catch {
    return initial;
  }
}

function saveProgress(p: ProgressState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function useProgress() {
  const [state, setState] = useState<ProgressState>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadProgress());
    setHydrated(true);
  }, []);

  const update = useCallback((next: ProgressState) => {
    setState(next);
    saveProgress(next);
  }, []);

  const recordChapterResult = useCallback(
    (grade: number, chapterId: number, score: number, total: number, opts?: { dailyBonus?: boolean }) => {
      const key = `${grade}-${chapterId}`;
      setState((prev) => {
        const pct = total > 0 ? score / total : 0;
        const stars: 0 | 1 | 2 | 3 = pct >= 0.85 ? 3 : pct >= 0.6 ? 2 : pct >= 0.35 ? 1 : 0;
        const existing = prev.chapters[key];
        const best = Math.max(existing?.best ?? 0, score);
        const bestStars = Math.max(existing?.stars ?? 0, stars) as 0 | 1 | 2 | 3;
        const newChapter: ChapterProgress = {
          best,
          total,
          stars: bestStars,
          attempts: (existing?.attempts ?? 0) + 1,
        };
        const starsDelta = bestStars - (existing?.stars ?? 0);
        const today = todayStr();
        let streak = prev.streak;
        if (prev.lastPlayed !== today) {
          const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
          streak = prev.lastPlayed === yesterday ? prev.streak + 1 : 1;
        }
        const xpGain = score * 10 * (opts?.dailyBonus ? 2 : 1);
        const next: ProgressState = {
          ...prev,
          chapters: { ...prev.chapters, [key]: newChapter },
          totalStars: prev.totalStars + Math.max(0, starsDelta),
          xp: prev.xp + xpGain,
          streak,
          lastPlayed: today,
          lastDaily: opts?.dailyBonus ? today : prev.lastDaily,
        };
        saveProgress(next);
        return next;
      });
    },
    [],
  );

  const bumpConceptStar = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, conceptStars: prev.conceptStars + 1, xp: prev.xp + 5 };
      saveProgress(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => update(initial), [update]);

  return { state, hydrated, recordChapterResult, bumpConceptStar, reset };
}

export function getChapterKey(grade: number, chapterId: number) {
  return `${grade}-${chapterId}`;
}

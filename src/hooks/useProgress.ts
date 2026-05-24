import { useCallback, useEffect, useState } from "react";
import type { QuizQuestion } from "@/lib/quiz.functions";

const STORAGE_KEY = "hbk-maths-progress-v1";
const MISTAKES_KEY = "hbk-mistakes-v1";
const MAX_MISTAKES = 100;

export type ChapterProgress = {
  best: number;
  total: number;
  stars: 0 | 1 | 2 | 3;
  attempts: number;
  correct?: number; // rolling correct count
  asked?: number; // rolling asked count
};

export type ProgressState = {
  chapters: Record<string, ChapterProgress>;
  totalStars: number;
  conceptStars: number;
  xp: number;
  streak: number;
  lastPlayed: string | null;
  lastDaily: string | null;
};

export type StoredMistake = {
  id: string; // hash-ish key: `${grade}-${chapterId}-${prompt}`
  grade: number;
  chapterId: number;
  chapterTitle: string;
  question: QuizQuestion;
  studentAnswer: string;
  timesWrong: number;
  timesRight: number;
  savedAt: number;
  /** SM-2 lite: consecutive correct count */
  streak?: number;
  /** SM-2 lite: epoch ms when this mistake is due for review */
  nextDueAt?: number;
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

export function loadMistakes(): StoredMistake[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MISTAKES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as StoredMistake[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveMistakes(list: StoredMistake[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MISTAKES_KEY, JSON.stringify(list.slice(0, MAX_MISTAKES)));
}

function mistakeId(grade: number, chapterId: number, prompt: string) {
  return `${grade}-${chapterId}-${prompt.slice(0, 80)}`;
}

const DAY = 86_400_000;
const SRS_SCHEDULE = [0, 1, 3, 7, 16]; // days per streak level

export function addMistake(input: {
  grade: number;
  chapterId: number;
  chapterTitle: string;
  question: QuizQuestion;
  studentAnswer: string;
}) {
  const list = loadMistakes();
  const id = mistakeId(input.grade, input.chapterId, input.question.prompt);
  const existing = list.find((m) => m.id === id);
  if (existing) {
    existing.timesWrong += 1;
    existing.studentAnswer = input.studentAnswer;
    existing.savedAt = Date.now();
    existing.streak = 0;
    existing.nextDueAt = Date.now(); // due immediately
  } else {
    list.unshift({
      id,
      grade: input.grade,
      chapterId: input.chapterId,
      chapterTitle: input.chapterTitle,
      question: input.question,
      studentAnswer: input.studentAnswer,
      timesWrong: 1,
      timesRight: 0,
      savedAt: Date.now(),
      streak: 0,
      nextDueAt: Date.now(),
    });
  }
  saveMistakes(list);
}

export function recordMistakeOutcome(id: string, wasCorrect: boolean) {
  const list = loadMistakes();
  const m = list.find((x) => x.id === id);
  if (!m) return;
  if (wasCorrect) {
    m.timesRight += 1;
    m.streak = (m.streak ?? 0) + 1;
    // Mastered after 2 consecutive correct -> drop from bank
    if (m.streak >= 2) {
      saveMistakes(list.filter((x) => x.id !== id));
      return;
    }
    const idx = Math.min(m.streak, SRS_SCHEDULE.length - 1);
    m.nextDueAt = Date.now() + SRS_SCHEDULE[idx] * DAY;
  } else {
    m.timesWrong += 1;
    m.timesRight = 0;
    m.streak = 0;
    m.nextDueAt = Date.now();
  }
  saveMistakes(list);
}

export function clearMistakes() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MISTAKES_KEY);
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
          correct: (existing?.correct ?? 0) + score,
          asked: (existing?.asked ?? 0) + total,
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

  const reset = useCallback(() => {
    update(initial);
    clearMistakes();
  }, [update]);

  return { state, hydrated, recordChapterResult, bumpConceptStar, reset };
}

export function getChapterKey(grade: number, chapterId: number) {
  return `${grade}-${chapterId}`;
}

/**
 * Lightweight mastery tracker. We bucket every answered question by
 * (grade, chapter, difficulty) since the AI already tags difficulty
 * (easy/medium/hard) on every MCQ.
 */
const KEY = "hbk-mastery-v1";

export type Bucket = "easy" | "medium" | "hard";
type Cell = { right: number; total: number };
type Store = Record<string, Cell>; // `${grade}-${chapter}-${bucket}` -> cell

function load(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function save(s: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function recordAnswer(grade: number, chapterId: number, bucket: Bucket, correct: boolean) {
  const s = load();
  const k = `${grade}-${chapterId}-${bucket}`;
  const cell = s[k] ?? { right: 0, total: 0 };
  cell.total += 1;
  if (correct) cell.right += 1;
  s[k] = cell;
  save(s);
}

export type ChapterMastery = {
  easy: Cell;
  medium: Cell;
  hard: Cell;
  overall: Cell;
};

export function getChapterMastery(grade: number, chapterId: number): ChapterMastery {
  const s = load();
  const easy = s[`${grade}-${chapterId}-easy`] ?? { right: 0, total: 0 };
  const medium = s[`${grade}-${chapterId}-medium`] ?? { right: 0, total: 0 };
  const hard = s[`${grade}-${chapterId}-hard`] ?? { right: 0, total: 0 };
  return {
    easy,
    medium,
    hard,
    overall: {
      right: easy.right + medium.right + hard.right,
      total: easy.total + medium.total + hard.total,
    },
  };
}

export function pct(c: Cell): number {
  return c.total === 0 ? 0 : Math.round((c.right / c.total) * 100);
}

/**
 * Suggest a difficulty mix for the next quiz based on overall accuracy:
 * <40%  → easy, 40-75% → mixed, >75% → hard.
 */
export function suggestDifficulty(grade: number, chapterId: number): "easy" | "mixed" | "hard" {
  const m = getChapterMastery(grade, chapterId);
  const p = pct(m.overall);
  if (m.overall.total < 5) return "mixed";
  if (p < 40) return "easy";
  if (p > 75) return "hard";
  return "mixed";
}

/**
 * Coarse student-level signal for adapting tutor / lesson depth.
 */
export function suggestStudentLevel(
  grade: number,
  chapterId: number,
): "beginner" | "developing" | "proficient" {
  const m = getChapterMastery(grade, chapterId);
  if (m.overall.total < 5) return "developing";
  const p = pct(m.overall);
  if (p < 45) return "beginner";
  if (p > 78) return "proficient";
  return "developing";
}

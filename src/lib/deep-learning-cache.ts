import type { QueryClient } from "@tanstack/react-query";
import type {
  PathwayTopic,
  TopicLesson,
  SolvedExample,
  ExamQuestion,
} from "@/lib/quiz.functions";

export const PATHWAY_PREFIX = "hbk-pathway-v1:";
export const LESSON_PREFIX = "hbk-lesson-v1:";
export const SOLVED_PREFIX = "hbk-solved-v1:";
export const EXAM_PREFIX = "hbk-exam-v1:";

export function pathwayKey(grade: number, chapterId: number) {
  return `${PATHWAY_PREFIX}${grade}-${chapterId}`;
}
export function lessonKey(grade: number, chapterId: number, topic: string) {
  return `${LESSON_PREFIX}${grade}-${chapterId}-${topic}`;
}
export function solvedKey(grade: number, chapterId: number) {
  return `${SOLVED_PREFIX}${grade}-${chapterId}`;
}
export function examKey(grade: number, chapterId: number) {
  return `${EXAM_PREFIX}${grade}-${chapterId}`;
}

export function readJSON<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}
export function writeJSON(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

type GenPathway = (a: { data: { grade: number; chapterTitle: string } }) => Promise<{ topics: PathwayTopic[] }>;
type GenLesson = (a: {
  data: { grade: number; chapterTitle: string; topicTitle: string; nextTopicTitle?: string };
}) => Promise<TopicLesson>;
type GenSolved = (a: { data: { grade: number; chapterTitle: string } }) => Promise<{ examples: SolvedExample[] }>;
type GenExam = (a: { data: { grade: number; chapterTitle: string } }) => Promise<{ questions: ExamQuestion[] }>;

export async function ensurePathway(
  qc: QueryClient,
  fn: GenPathway,
  grade: number,
  chapterId: number,
  chapterTitle: string,
): Promise<PathwayTopic[]> {
  const key = pathwayKey(grade, chapterId);
  const cached = readJSON<PathwayTopic[]>(key);
  if (cached) return cached;
  return qc.fetchQuery({
    queryKey: ["pathway", grade, chapterId],
    queryFn: async () => {
      const r = await fn({ data: { grade, chapterTitle } });
      writeJSON(key, r.topics);
      return r.topics;
    },
  });
}

export async function ensureSolved(
  qc: QueryClient,
  fn: GenSolved,
  grade: number,
  chapterId: number,
  chapterTitle: string,
): Promise<SolvedExample[]> {
  const key = solvedKey(grade, chapterId);
  const cached = readJSON<SolvedExample[]>(key);
  if (cached) return cached;
  return qc.fetchQuery({
    queryKey: ["solved", grade, chapterId],
    queryFn: async () => {
      const r = await fn({ data: { grade, chapterTitle } });
      writeJSON(key, r.examples);
      return r.examples;
    },
  });
}

export async function ensureExam(
  qc: QueryClient,
  fn: GenExam,
  grade: number,
  chapterId: number,
  chapterTitle: string,
): Promise<ExamQuestion[]> {
  const key = examKey(grade, chapterId);
  const cached = readJSON<ExamQuestion[]>(key);
  if (cached) return cached;
  return qc.fetchQuery({
    queryKey: ["exam", grade, chapterId],
    queryFn: async () => {
      const r = await fn({ data: { grade, chapterTitle } });
      writeJSON(key, r.questions);
      return r.questions;
    },
  });
}

export async function ensureTopicLesson(
  qc: QueryClient,
  fn: GenLesson,
  grade: number,
  chapterId: number,
  chapterTitle: string,
  topicTitle: string,
  nextTopicTitle?: string,
): Promise<TopicLesson> {
  const key = lessonKey(grade, chapterId, topicTitle);
  const cached = readJSON<TopicLesson>(key);
  if (cached) return cached;
  return qc.fetchQuery({
    queryKey: ["lesson", grade, chapterId, topicTitle],
    queryFn: async () => {
      const r = await fn({ data: { grade, chapterTitle, topicTitle, nextTopicTitle } });
      writeJSON(key, r);
      return r;
    },
  });
}

/** Fetch all topic lessons with bounded concurrency. */
export async function ensureAllTopicLessons(
  qc: QueryClient,
  fn: GenLesson,
  grade: number,
  chapterId: number,
  chapterTitle: string,
  topics: PathwayTopic[],
  opts: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<Array<{ topic: PathwayTopic; lesson: TopicLesson | null }>> {
  const concurrency = opts.concurrency ?? 3;
  const out: Array<{ topic: PathwayTopic; lesson: TopicLesson | null }> = topics.map((t) => ({
    topic: t,
    lesson: null,
  }));
  let done = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < topics.length) {
      const i = cursor++;
      try {
        out[i].lesson = await ensureTopicLesson(
          qc,
          fn,
          grade,
          chapterId,
          chapterTitle,
          topics[i].title,
          topics[i + 1]?.title,
        );
      } catch (e) {
        console.error("topic lesson failed", topics[i].title, e);
      } finally {
        done++;
        opts.onProgress?.(done, topics.length);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, topics.length) }, () => worker()));
  return out;
}

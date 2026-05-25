import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Sparkles,
  BookText,
  GraduationCap,
  Map,
  Lightbulb,
  AlertTriangle,
  Target,
} from "lucide-react";
import {
  generateChapterPathway,
  generateTopicLesson,
  generateSolvedExamples,
  generateExamCorner,
  type PathwayTopic,
  type TopicLesson,
  type SolvedExample,
  type ExamQuestion,
} from "@/lib/quiz.functions";

const PATHWAY_PREFIX = "hbk-pathway-v1:";
const LESSON_PREFIX = "hbk-lesson-v1:";
const PROGRESS_PREFIX = "hbk-pathway-progress-v1:";
const SOLVED_PREFIX = "hbk-solved-v1:";
const EXAM_PREFIX = "hbk-exam-v1:";

function readJSON<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}
function writeJSON(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

// =========================================================
// Learning Pathway
// =========================================================
export function LearningPathway({
  grade,
  chapterId,
  chapterTitle,
}: {
  grade: number;
  chapterId: number;
  chapterTitle: string;
}) {
  const genPathway = useServerFn(generateChapterPathway);
  const pathwayKey = `${PATHWAY_PREFIX}${grade}-${chapterId}`;
  const progressKey = `${PROGRESS_PREFIX}${grade}-${chapterId}`;

  const [progress, setProgress] = useState<Record<string, boolean>>(
    () => readJSON<Record<string, boolean>>(progressKey) ?? {},
  );
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const pathwayQ = useQuery({
    queryKey: ["pathway", grade, chapterId],
    queryFn: async () => {
      const res = await genPathway({ data: { grade, chapterTitle } });
      writeJSON(pathwayKey, res.topics);
      return res.topics;
    },
    initialData: () => readJSON<PathwayTopic[]>(pathwayKey),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  function toggleDone(title: string) {
    const next = { ...progress, [title]: !progress[title] };
    setProgress(next);
    writeJSON(progressKey, next);
  }

  const topics = pathwayQ.data ?? [];
  const doneCount = topics.filter((t) => progress[t.title]).length;
  const pct = topics.length ? Math.round((doneCount / topics.length) * 100) : 0;

  return (
    <div>
      {pathwayQ.isPending && !pathwayQ.data && (
        <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm font-semibold">
          <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
          Designing your learning pathway…
        </div>
      )}
      {pathwayQ.isError && !pathwayQ.data && (
        <p className="text-destructive text-sm font-semibold">
          {(pathwayQ.error as Error).message}
        </p>
      )}

      {topics.length > 0 && (
        <>
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-xs font-bold">
              <span className="text-muted-foreground tracking-[0.18em] uppercase">
                Your roadmap
              </span>
              <span className="text-primary">
                {doneCount} / {topics.length} topics · {pct}%
              </span>
            </div>
            <div className="bg-secondary h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <ol className="space-y-2">
            {topics.map((t, i) => {
              const isOpen = openIdx === i;
              const done = !!progress[t.title];
              return (
                <li key={i} className="bg-secondary/40 rounded-2xl">
                  <button
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <span
                      className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-extrabold ${
                        done
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground border-border border"
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-extrabold">{t.title}</span>
                      <span className="text-muted-foreground block text-xs">
                        {t.oneLiner}
                      </span>
                    </span>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-border border-t p-3">
                      <TopicLessonView
                        grade={grade}
                        chapterId={chapterId}
                        chapterTitle={chapterTitle}
                        topicTitle={t.title}
                        nextTopicTitle={topics[i + 1]?.title}
                        done={done}
                        onToggleDone={() => toggleDone(t.title)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}

function TopicLessonView({
  grade,
  chapterId,
  chapterTitle,
  topicTitle,
  nextTopicTitle,
  done,
  onToggleDone,
}: {
  grade: number;
  chapterId: number;
  chapterTitle: string;
  topicTitle: string;
  nextTopicTitle?: string;
  done: boolean;
  onToggleDone: () => void;
}) {
  const genLesson = useServerFn(generateTopicLesson);
  const key = `${LESSON_PREFIX}${grade}-${chapterId}-${topicTitle}`;
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const q = useQuery({
    queryKey: ["lesson", grade, chapterId, topicTitle],
    queryFn: async () => {
      const res = await genLesson({
        data: { grade, chapterTitle, topicTitle, nextTopicTitle },
      });
      writeJSON(key, res);
      return res;
    },
    initialData: () => readJSON<TopicLesson>(key),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  if (q.isPending && !q.data) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-2 text-sm font-semibold">
        <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
        Preparing this lesson…
      </div>
    );
  }
  if (q.isError && !q.data) {
    return (
      <p className="text-destructive text-sm font-semibold">
        {(q.error as Error).message}
      </p>
    );
  }
  const lesson = q.data!;
  return (
    <div className="space-y-3 text-sm">
      {lesson.prerequisites && (
        <p className="bg-card rounded-xl p-2 text-xs">
          <span className="font-extrabold">Prerequisites: </span>
          {lesson.prerequisites}
        </p>
      )}
      <p>
        <span className="font-extrabold">Intuition: </span>
        {lesson.intuition}
      </p>
      <p>
        <span className="font-extrabold">Definition: </span>
        {lesson.definition}
      </p>
      {lesson.derivation && (
        <div className="bg-card rounded-xl p-3">
          <p className="text-primary mb-1 text-[10px] font-extrabold tracking-[0.18em] uppercase">
            {grade >= 8 ? "Derivation" : "Why it works"}
          </p>
          <p className="whitespace-pre-line">{lesson.derivation}</p>
        </div>
      )}

      <div>
        <p className="text-primary mb-1 text-[10px] font-extrabold tracking-[0.18em] uppercase">
          Worked examples
        </p>
        <div className="space-y-2">
          {lesson.workedExamples.map((ex, i) => (
            <div key={i} className="bg-card rounded-xl p-3">
              <p className="font-extrabold">
                Example {i + 1}. <span className="font-normal">{ex.problem}</span>
              </p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs">
                {ex.steps.map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ol>
              <p className="bg-primary/10 text-primary mt-2 inline-block rounded px-2 py-0.5 text-xs font-extrabold">
                Answer: {ex.finalAnswer}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-primary mb-1 flex items-center gap-1 text-[10px] font-extrabold tracking-[0.18em] uppercase">
          <AlertTriangle className="h-3 w-3" /> Common mistakes
        </p>
        <ul className="list-disc space-y-0.5 pl-5 text-xs">
          {lesson.commonMistakes.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-primary mb-1 flex items-center gap-1 text-[10px] font-extrabold tracking-[0.18em] uppercase">
          <Target className="h-3 w-3" /> Quick check
        </p>
        <div className="space-y-2">
          {lesson.practiceCheck.map((p, i) => (
            <div key={i} className="bg-card rounded-xl p-2 text-xs">
              <p>
                <span className="font-extrabold">Q{i + 1}. </span>
                {p.question}
              </p>
              {revealed[i] ? (
                <p className="text-primary mt-1 font-extrabold">Answer: {p.answer}</p>
              ) : (
                <button
                  onClick={() => setRevealed((r) => ({ ...r, [i]: true }))}
                  className="text-primary mt-1 text-[11px] font-bold underline"
                >
                  Show answer
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {lesson.whatsNext && (
        <p className="text-muted-foreground text-xs italic">
          <Lightbulb className="mr-1 inline h-3 w-3" />
          What's next: {lesson.whatsNext}
        </p>
      )}

      <button
        onClick={onToggleDone}
        className={`mt-2 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
          done
            ? "bg-primary text-primary-foreground"
            : "border-primary text-primary border-2"
        }`}
      >
        <Check className="h-3.5 w-3.5" />
        {done ? "Marked complete" : "Mark topic complete"}
      </button>
    </div>
  );
}

// =========================================================
// Solved Examples
// =========================================================
export function SolvedExamples({
  grade,
  chapterId,
  chapterTitle,
}: {
  grade: number;
  chapterId: number;
  chapterTitle: string;
}) {
  const gen = useServerFn(generateSolvedExamples);
  const key = `${SOLVED_PREFIX}${grade}-${chapterId}`;
  const q = useQuery({
    queryKey: ["solved", grade, chapterId],
    queryFn: async () => {
      const res = await gen({ data: { grade, chapterTitle } });
      writeJSON(key, res.examples);
      return res.examples;
    },
    initialData: () => readJSON<SolvedExample[]>(key),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  if (q.isPending && !q.data) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm font-semibold">
        <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
        Building solved examples…
      </div>
    );
  }
  if (q.isError && !q.data) {
    return (
      <p className="text-destructive text-sm font-semibold">{(q.error as Error).message}</p>
    );
  }
  return (
    <div className="space-y-3">
      {q.data?.map((ex, i) => (
        <div key={i} className="bg-secondary/40 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-extrabold">
              <Sparkles className="text-primary mr-1 inline h-4 w-4" />
              Example {i + 1}. {ex.title}
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${
                ex.difficulty === "easy"
                  ? "bg-green-100 text-green-800"
                  : ex.difficulty === "hard"
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"
              }`}
            >
              {ex.difficulty}
            </span>
          </div>
          <p className="mt-2 text-sm">
            <span className="font-bold">Given: </span>
            {ex.given}
          </p>
          <p className="text-sm">
            <span className="font-bold">To find: </span>
            {ex.toFind}
          </p>
          <p className="text-muted-foreground mt-1 text-xs italic">Method: {ex.method}</p>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm">
            {ex.steps.map((s, j) => (
              <li key={j}>{s}</li>
            ))}
          </ol>
          <p className="bg-primary/10 text-primary mt-2 inline-block rounded px-2 py-1 text-sm font-extrabold">
            Final answer: {ex.finalAnswer}
          </p>
          {ex.alternateMethod && (
            <p className="text-muted-foreground mt-2 text-xs">
              <span className="font-bold">Alternate method: </span>
              {ex.alternateMethod}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// =========================================================
// Exam Corner
// =========================================================
export function ExamCorner({
  grade,
  chapterId,
  chapterTitle,
}: {
  grade: number;
  chapterId: number;
  chapterTitle: string;
}) {
  const gen = useServerFn(generateExamCorner);
  const key = `${EXAM_PREFIX}${grade}-${chapterId}`;
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const q = useQuery({
    queryKey: ["exam", grade, chapterId],
    queryFn: async () => {
      const res = await gen({ data: { grade, chapterTitle } });
      writeJSON(key, res.questions);
      return res.questions;
    },
    initialData: () => readJSON<ExamQuestion[]>(key),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  if (q.isPending && !q.data) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm font-semibold">
        <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
        Loading exam corner…
      </div>
    );
  }
  if (q.isError && !q.data) {
    return (
      <p className="text-destructive text-sm font-semibold">{(q.error as Error).message}</p>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        {grade >= 9
          ? "CBSE Board-pattern / PYQ-style questions with marking-scheme cues."
          : "School test + Olympiad / NTSE-foundation style questions."}
      </p>
      {q.data?.map((it, i) => (
        <div key={i} className="bg-secondary/40 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-extrabold">
              <GraduationCap className="text-primary mr-1 inline h-4 w-4" />
              Q{i + 1}. {it.question}
            </p>
            <span className="bg-primary/10 text-primary flex-none rounded-full px-2 py-0.5 text-[10px] font-extrabold">
              {it.marks} mark{it.marks > 1 ? "s" : ""}
            </span>
          </div>
          <p className="bg-card mt-2 rounded-lg p-2 text-xs">
            <span className="font-extrabold">Examiner expects: </span>
            {it.examinerExpects}
          </p>
          {revealed[i] ? (
            <div className="mt-2">
              <p className="text-primary text-[10px] font-extrabold tracking-[0.18em] uppercase">
                Model answer
              </p>
              <p className="whitespace-pre-line text-sm">{it.modelAnswer}</p>
            </div>
          ) : (
            <button
              onClick={() => setRevealed((r) => ({ ...r, [i]: true }))}
              className="text-primary mt-2 text-xs font-bold underline"
            >
              Show model answer
            </button>
          )}
          <div className="text-muted-foreground mt-2 flex flex-wrap gap-3 text-[11px]">
            {it.timeTip && (
              <span>
                <Lightbulb className="mr-1 inline h-3 w-3" />
                {it.timeTip}
              </span>
            )}
            {it.source && (
              <span>
                <BookText className="mr-1 inline h-3 w-3" />
                {it.source}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Re-export icons for the parent tabs UI
export const DeepLearningIcons = { Map, BookText, GraduationCap };

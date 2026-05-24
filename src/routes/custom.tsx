import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Minus, Plus, Timer, Trophy, Zap } from "lucide-react";
import { GRADE_THEMES } from "@/data/grade-themes";
import { getChapters } from "@/data/ncert-maths";
import { generateChapterQuiz, type QuizQuestion } from "@/lib/quiz.functions";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { useProgress } from "@/hooks/useProgress";

export const Route = createFileRoute("/custom")({
  head: () => ({
    meta: [
      { title: "Custom Maths Test · Build Your Own | HBK Maths Quest" },
      {
        name: "description",
        content:
          "Pick a grade, tick the chapters you want, choose your marks, and take a custom NCERT Maths test.",
      },
    ],
  }),
  component: CustomPage,
});

const MARK_CHIPS = [10, 20, 30, 50];

type RunnerQ = QuizQuestion & { _chapterId: number; _chapterTitle: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function CustomPage() {
  const generate = useServerFn(generateChapterQuiz);
  const { recordChapterResult } = useProgress();
  const [grade, setGrade] = useState(5);
  const [selectedIds, setSelectedIds] = useState<number[]>([1]);
  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<"self" | "timed">("self");
  const [minutes, setMinutes] = useState(30);
  const [questions, setQuestions] = useState<RunnerQ[] | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  const chapters = useMemo(() => getChapters(grade), [grade]);

  const selectedChapters = chapters.filter((c) => selectedIds.includes(c.id));
  const perChapter = selectedChapters.length
    ? Math.max(1, Math.ceil(count / selectedChapters.length))
    : 0;

  function toggleChapter(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function changeGrade(g: number) {
    setGrade(g);
    setSelectedIds([1]);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const batches = await Promise.all(
        selectedChapters.map(async (c) => {
          const res = await generate({
            data: { grade, chapterTitle: c.title, count: perChapter },
          });
          return res.questions
            .filter(
              (q) =>
                q.type === "mcq" &&
                Array.isArray(q.options) &&
                q.options.length === 4 &&
                q.options.includes(q.answer),
            )
            .map((q) => ({
              ...(q as QuizQuestion),
              _chapterId: c.id,
              _chapterTitle: c.title,
            })) as RunnerQ[];
        }),
      );
      const merged = shuffle(batches.flat()).slice(0, count);
      if (merged.length === 0) throw new Error("Could not generate questions. Try again.");
      return merged;
    },
    onSuccess: (qs) => {
      setQuestions(qs);
      if (mode === "timed") {
        const d = Date.now() + minutes * 60 * 1000;
        setDeadlineAt(d);
        setRemaining(minutes * 60);
      } else {
        setDeadlineAt(null);
      }
    },
  });

  useEffect(() => {
    if (!deadlineAt) return;
    const t = setInterval(() => {
      setRemaining(Math.max(0, Math.round((deadlineAt - Date.now()) / 1000)));
    }, 500);
    return () => clearInterval(t);
  }, [deadlineAt]);

  if (questions) {
    const firstChapter = selectedChapters[0];
    const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
    const ss = (remaining % 60).toString().padStart(2, "0");
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            onClick={() => { setQuestions(null); setDeadlineAt(null); }}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> New test
          </button>
          {deadlineAt && (
            <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 font-bold ${remaining < 60 ? "bg-destructive/10 text-destructive" : "bg-secondary"}`}>
              <Timer className="h-4 w-4" /> {mm}:{ss}
            </div>
          )}
        </div>
        <QuizRunner
          questions={questions}
          title={mode === "timed" ? `Timed test · ${questions.length} Q · ${minutes} min` : `Self-paced · ${questions.length} marks`}
          subtitle={`Grade ${grade} · ${selectedChapters.length} chapter${selectedChapters.length > 1 ? "s" : ""}`}
          deadlineAt={deadlineAt ?? undefined}
          context={
            firstChapter
              ? {
                  grade,
                  chapterId: firstChapter.id,
                  chapterTitle: firstChapter.title,
                }
              : undefined
          }
          onComplete={(score, total) => {
            const counts = new Map<number, { title: string; total: number; correct: number }>();
            for (const q of questions) {
              const entry = counts.get(q._chapterId) ?? { title: q._chapterTitle, total: 0, correct: 0 };
              entry.total += 1;
              counts.set(q._chapterId, entry);
            }
            for (const [cid, info] of counts) {
              const proportionalScore = Math.round((info.total / total) * score);
              recordChapterResult(grade, cid, proportionalScore, info.total);
            }
          }}
        />
      </div>
    );
  }

  const canStart = selectedChapters.length > 0 && !mutation.isPending;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        to="/"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-semibold"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <div className="bg-gradient-custom shadow-glow mb-6 rounded-3xl p-6 text-white">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-90">
          Build Your Own
        </p>
        <h1 className="text-3xl font-extrabold">Custom Test</h1>
        <p className="mt-1 text-sm opacity-90">
          Tick the chapters, pick your marks, and get a fresh test.
        </p>
      </div>

      <div className="bg-card shadow-card space-y-5 rounded-3xl p-6">
        {/* GRADE */}
        <label className="block">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
            Grade
          </span>
          <select
            value={grade}
            onChange={(e) => changeGrade(Number(e.target.value))}
            className="border-border bg-card mt-1 w-full rounded-xl border-2 px-4 py-3 font-semibold outline-none"
          >
            {GRADE_THEMES.map((t) => (
              <option key={t.grade} value={t.grade}>
                Grade {t.grade} · {t.world}
              </option>
            ))}
          </select>
        </label>

        {/* CHAPTERS — multi-select checklist */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
              Chapters · pick one or more
            </span>
            <div className="flex gap-2 text-xs font-bold">
              <button
                onClick={() => setSelectedIds(chapters.map((c) => c.id))}
                className="text-primary hover:underline"
              >
                Select all
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                onClick={() => setSelectedIds([])}
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="border-border max-h-64 overflow-y-auto rounded-xl border-2">
            {chapters.map((c) => {
              const checked = selectedIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleChapter(c.id)}
                  className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left transition last:border-b-0 ${
                    checked ? "bg-primary/5" : "hover:bg-secondary/50"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 flex-none items-center justify-center rounded border-2 transition ${
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="text-sm font-semibold">
                    {c.id}. {c.title}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-muted-foreground mt-2 text-xs font-semibold">
            {selectedChapters.length === 0
              ? "Tick at least one chapter to continue."
              : `${selectedChapters.length} chapter${selectedChapters.length > 1 ? "s" : ""} selected.`}
          </p>
        </div>

        {/* MARKS */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
              Marks
            </span>
            <span className="text-xs font-bold">≈ {count} marks (1 each)</span>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {MARK_CHIPS.map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition ${
                  count === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCount((c) => Math.max(5, c - 5))}
              className="border-border hover:border-primary flex h-10 w-10 items-center justify-center rounded-xl border-2 font-bold"
              aria-label="Decrease"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={5}
              max={50}
              step={1}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setCount((c) => Math.min(50, c + 5))}
              className="border-border hover:border-primary flex h-10 w-10 items-center justify-center rounded-xl border-2 font-bold"
              aria-label="Increase"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="bg-secondary w-14 rounded-xl px-3 py-2 text-center font-extrabold">
              {count}
            </div>
          </div>

          {selectedChapters.length > 0 && (
            <p className="text-muted-foreground mt-2 text-xs">
              We&apos;ll generate ~{perChapter} question
              {perChapter > 1 ? "s" : ""} from each of your {selectedChapters.length} chapter
              {selectedChapters.length > 1 ? "s" : ""} (in parallel — usually under 10 seconds).
            </p>
          )}
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={!canStart}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-xl px-5 py-3 font-bold disabled:opacity-50"
        >
          {mutation.isPending
            ? `Generating ${count}-mark test…`
            : `Start test · ${count} marks`}
        </button>
        {mutation.isError && (
          <p className="text-destructive text-sm font-semibold">
            {(mutation.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
}

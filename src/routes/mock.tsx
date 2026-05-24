import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Timer, Trophy } from "lucide-react";
import { GRADE_THEMES } from "@/data/grade-themes";
import { getChapters } from "@/data/ncert-maths";
import { generateChapterQuiz, type QuizQuestion } from "@/lib/quiz.functions";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { useProgress } from "@/hooks/useProgress";

export const Route = createFileRoute("/mock")({
  head: () => ({
    meta: [
      { title: "Mock Exam · Timed NCERT Maths Practice | HBK Maths Quest" },
      { name: "description", content: "Take a timed mixed-chapter mock exam to simulate real test conditions." },
    ],
  }),
  component: MockPage,
});

type RunnerQ = QuizQuestion & { _cid: number; _ct: string };

function shuffle<T>(a: T[]): T[] { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

function MockPage() {
  const generate = useServerFn(generateChapterQuiz);
  const { recordChapterResult } = useProgress();
  const [grade, setGrade] = useState(8);
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(30);
  const [questions, setQuestions] = useState<RunnerQ[] | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  const chapters = useMemo(() => getChapters(grade), [grade]);

  const mut = useMutation({
    mutationFn: async () => {
      const picks = shuffle(chapters).slice(0, Math.min(5, chapters.length));
      const per = Math.max(1, Math.ceil(count / picks.length));
      const batches = await Promise.all(picks.map(async (c) => {
        const r = await generate({ data: { grade, chapterTitle: c.title, count: per, difficulty: "mixed" } });
        return r.questions.map((q) => ({ ...(q as QuizQuestion), _cid: c.id, _ct: c.title })) as RunnerQ[];
      }));
      const merged = shuffle(batches.flat()).slice(0, count);
      if (!merged.length) throw new Error("Couldn't build the mock. Try again.");
      return merged;
    },
    onSuccess: (qs) => { setQuestions(qs); setStartedAt(Date.now()); setRemaining(minutes * 60); },
  });

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  if (questions) {
    const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
    const ss = (remaining % 60).toString().padStart(2, "0");
    const first = questions[0];
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => { setQuestions(null); setStartedAt(null); }} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-semibold">
            <ArrowLeft className="h-4 w-4" /> Exit mock
          </button>
          <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 font-bold ${remaining < 60 ? "bg-destructive/10 text-destructive" : "bg-secondary"}`}>
            <Timer className="h-4 w-4" /> {mm}:{ss}
          </div>
        </div>
        <QuizRunner
          questions={questions}
          title={`Mock Exam · Grade ${grade}`}
          subtitle={`${questions.length} questions · ${minutes} min`}
          context={{ grade, chapterId: first._cid, chapterTitle: first._ct }}
          onComplete={(score, total) => {
            const counts = new Map<number, { title: string; total: number }>();
            for (const q of questions) {
              const e = counts.get(q._cid) ?? { title: q._ct, total: 0 };
              e.total += 1; counts.set(q._cid, e);
            }
            for (const [cid, info] of counts) {
              const ps = Math.round((info.total / total) * score);
              recordChapterResult(grade, cid, ps, info.total);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link to="/" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <div className="bg-gradient-hero shadow-glow mb-6 rounded-3xl p-6 text-white">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-90">Exam Day Practice</p>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Trophy className="h-7 w-7" /> Mock Exam</h1>
        <p className="mt-1 text-sm opacity-90">Mixed-chapter, timed, no second chances. Just like the real thing.</p>
      </div>
      <div className="bg-card shadow-card space-y-4 rounded-3xl p-6">
        <label className="block">
          <span className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">Grade</span>
          <select value={grade} onChange={(e) => setGrade(Number(e.target.value))} className="border-border bg-card mt-1 w-full rounded-xl border-2 px-4 py-3 font-semibold outline-none">
            {GRADE_THEMES.map((t) => <option key={t.grade} value={t.grade}>Grade {t.grade}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">Questions: {count}</span>
          <input type="range" min={10} max={40} step={5} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-2 w-full" />
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">Time limit: {minutes} min</span>
          <input type="range" min={10} max={90} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="mt-2 w-full" />
        </label>
        <button onClick={() => mut.mutate()} disabled={mut.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-xl px-5 py-3 font-bold disabled:opacity-50">
          {mut.isPending ? "Building your mock…" : "Start mock exam"}
        </button>
        {mut.isError && <p className="text-destructive text-sm font-semibold">{(mut.error as Error).message}</p>}
      </div>
    </div>
  );
}

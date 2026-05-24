import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { generateDailyChallenge, type QuizQuestion } from "@/lib/quiz.functions";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { useProgress } from "@/hooks/useProgress";

export const Route = createFileRoute("/daily")({
  head: () => ({
    meta: [
      { title: "Daily Maths Challenge · 2× XP | HBK Maths Quest" },
      { name: "description", content: "5 fresh mixed-grade NCERT Maths questions every day. Build your streak and earn double XP." },
    ],
  }),
  component: DailyPage,
});

function DailyPage() {
  const generate = useServerFn(generateDailyChallenge);
  const { recordChapterResult } = useProgress();

  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `hbk-daily-v2-${today}`;

  function filterMcq(qs: QuizQuestion[]): QuizQuestion[] {
    return qs.filter(
      (q) =>
        q.type === "mcq" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.includes(q.answer),
    );
  }

  const mutation = useMutation({
    mutationFn: async () => (await generate({ data: { seed: today } })).questions as QuizQuestion[],
    onSuccess: (qs) => {
      try { localStorage.setItem(cacheKey, JSON.stringify(qs)); } catch { /* ignore */ }
    },
  });

  useEffect(() => {
    const cached = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as QuizQuestion[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          (mutation as unknown as { data: QuizQuestion[] }).data = parsed;
          return;
        }
      } catch { /* ignore */ }
    }
    mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const cached = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
  const rawQuestions = mutation.data ?? (cached ? (JSON.parse(cached) as QuizQuestion[]) : undefined);
  const questions = rawQuestions ? filterMcq(rawQuestions) : undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <div className="bg-gradient-daily shadow-glow mb-6 rounded-3xl p-6 text-white">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-90">Daily Challenge</p>
        <h1 className="text-3xl font-extrabold">5 mixed questions · 2× XP</h1>
      </div>

      {mutation.isPending && !questions && (
        <div className="bg-card shadow-card rounded-3xl p-10 text-center">
          <div className="border-primary mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
          <p className="font-bold">Building today's challenge…</p>
        </div>
      )}
      {mutation.isError && (
        <p className="bg-destructive/10 text-destructive rounded-2xl p-4 font-semibold">
          {(mutation.error as Error).message}
        </p>
      )}
      {questions && (
        <QuizRunner
          questions={questions}
          title="Daily Challenge"
          subtitle={today}
          onComplete={(score, total) => recordChapterResult(0, 0, score, total, { dailyBonus: true })}
        />
      )}
    </div>
  );
}

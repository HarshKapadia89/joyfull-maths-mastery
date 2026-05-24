import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { GRADE_THEMES } from "@/data/grade-themes";
import { getChapters } from "@/data/ncert-maths";
import { generateChapterQuiz, type QuizQuestion } from "@/lib/quiz.functions";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { useProgress } from "@/hooks/useProgress";

export const Route = createFileRoute("/custom")({
  head: () => ({
    meta: [
      { title: "Custom Maths Test · Build Your Own | HBK Maths Quest" },
      { name: "description", content: "Pick a grade, chapter and number of NCERT Maths questions, then take a custom quiz." },
    ],
  }),
  component: CustomPage,
});

function CustomPage() {
  const generate = useServerFn(generateChapterQuiz);
  const { recordChapterResult } = useProgress();
  const [grade, setGrade] = useState(5);
  const [chapterId, setChapterId] = useState(1);
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);

  const chapters = getChapters(grade);
  const chapter = chapters.find((c) => c.id === chapterId) ?? chapters[0];

  const mutation = useMutation({
    mutationFn: async () =>
      (await generate({ data: { grade, chapterTitle: chapter.title, count } })).questions as QuizQuestion[],
    onSuccess: (qs) => setQuestions(qs),
  });

  if (questions) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <button onClick={() => setQuestions(null)} className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-semibold">
          <ArrowLeft className="h-4 w-4" /> New custom test
        </button>
        <QuizRunner
          questions={questions}
          title={chapter.title}
          subtitle={`Custom · Grade ${grade}`}
          onComplete={(score, total) => recordChapterResult(grade, chapter.id, score, total)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link to="/" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <div className="bg-gradient-custom shadow-glow mb-6 rounded-3xl p-6 text-white">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-90">Build Your Own</p>
        <h1 className="text-3xl font-extrabold">Custom Test</h1>
      </div>

      <div className="bg-card shadow-card space-y-4 rounded-3xl p-6">
        <label className="block">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">Grade</span>
          <select
            value={grade}
            onChange={(e) => {
              const g = Number(e.target.value);
              setGrade(g);
              setChapterId(1);
            }}
            className="border-border bg-card mt-1 w-full rounded-xl border-2 px-4 py-3 font-semibold outline-none"
          >
            {GRADE_THEMES.map((t) => (
              <option key={t.grade} value={t.grade}>Grade {t.grade} · {t.world}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">Chapter</span>
          <select
            value={chapterId}
            onChange={(e) => setChapterId(Number(e.target.value))}
            className="border-border bg-card mt-1 w-full rounded-xl border-2 px-4 py-3 font-semibold outline-none"
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>{c.id}. {c.title}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
            Number of questions: {count}
          </span>
          <input
            type="range"
            min={5}
            max={30}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="mt-2 w-full"
          />
        </label>

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-xl px-5 py-3 font-bold disabled:opacity-50"
        >
          {mutation.isPending ? "Generating…" : "Start custom test"}
        </button>
        {mutation.isError && (
          <p className="text-destructive text-sm font-semibold">{(mutation.error as Error).message}</p>
        )}
      </div>
    </div>
  );
}

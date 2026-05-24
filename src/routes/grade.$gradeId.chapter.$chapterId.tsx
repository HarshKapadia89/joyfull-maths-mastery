import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { getChapter } from "@/data/ncert-maths";
import { getTheme } from "@/data/grade-themes";
import { useProgress } from "@/hooks/useProgress";
import { generateChapterQuiz, type QuizQuestion } from "@/lib/quiz.functions";
import { QuizRunner } from "@/components/quiz/QuizRunner";

export const Route = createFileRoute("/grade/$gradeId/chapter/$chapterId")({
  beforeLoad: ({ params }) => {
    const g = Number(params.gradeId);
    const c = Number(params.chapterId);
    if (!Number.isInteger(g) || g < 1 || g > 10) throw notFound();
    const ch = getChapter(g, c);
    if (!ch) throw notFound();
  },
  head: ({ params }) => {
    const ch = getChapter(Number(params.gradeId), Number(params.chapterId));
    return {
      meta: [
        { title: `${ch?.title ?? "Quiz"} · Grade ${params.gradeId} | HBK Maths Quest` },
        { name: "description", content: `25 NCERT Grade ${params.gradeId} Maths questions on ${ch?.title}.` },
      ],
    };
  },
  component: ChapterQuiz,
});

const CACHE_PREFIX = "hbk-quiz-cache-v1:";

function ChapterQuiz() {
  const { gradeId, chapterId } = Route.useParams();
  const router = useRouter();
  const grade = Number(gradeId);
  const cId = Number(chapterId);
  const chapter = getChapter(grade, cId)!;
  const theme = getTheme(grade);
  const { recordChapterResult } = useProgress();
  const generate = useServerFn(generateChapterQuiz);

  const cacheKey = `${CACHE_PREFIX}${grade}-${cId}`;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await generate({ data: { grade, chapterTitle: chapter.title, count: 25 } });
      return res.questions as QuizQuestion[];
    },
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
          mutation.reset();
          // emulate success via cache by setting data manually
          // simplest: skip refetch, use cached via state below
          (mutation as unknown as { data: QuizQuestion[] }).data = parsed;
          return;
        }
      } catch { /* ignore */ }
    }
    mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const cached = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
  const questions: QuizQuestion[] | undefined =
    mutation.data ?? (cached ? (JSON.parse(cached) as QuizQuestion[]) : undefined);

  function regenerate() {
    try { localStorage.removeItem(cacheKey); } catch { /* ignore */ }
    mutation.mutate();
    router.invalidate();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/grade/$gradeId"
          params={{ gradeId }}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" /> Back to {theme.world}
        </Link>
        {questions && (
          <button
            onClick={regenerate}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" /> New set
          </button>
        )}
      </div>

      {mutation.isPending && !questions && (
        <div className="bg-card shadow-card mx-auto max-w-2xl rounded-3xl p-10 text-center">
          <div className="border-primary mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
          <p className="font-bold">HBK Mathy is preparing your 25 questions…</p>
          <p className="text-muted-foreground mt-1 text-sm">{chapter.title}</p>
        </div>
      )}

      {mutation.isError && (
        <div className="bg-destructive/10 text-destructive mx-auto max-w-2xl rounded-2xl p-6 text-center">
          <p className="font-bold">Couldn't generate questions.</p>
          <p className="mt-1 text-sm">{(mutation.error as Error).message}</p>
          <button
            onClick={() => mutation.mutate()}
            className="bg-destructive text-destructive-foreground mt-4 rounded-xl px-4 py-2 font-semibold"
          >
            Try again
          </button>
        </div>
      )}

      {questions && questions.length > 0 && (
        <QuizRunner
          key={cacheKey}
          questions={questions}
          title={chapter.title}
          subtitle={`Grade ${grade} · ${theme.world}`}
          onComplete={(score, total) => recordChapterResult(grade, cId, score, total)}
        />
      )}
    </div>
  );
}

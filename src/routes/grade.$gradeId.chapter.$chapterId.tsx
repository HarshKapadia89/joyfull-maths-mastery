import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { getChapter } from "@/data/ncert-maths";
import { getTheme } from "@/data/grade-themes";
import { useProgress } from "@/hooks/useProgress";
import { generateChapterQuiz, type QuizQuestion } from "@/lib/quiz.functions";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { ConceptCards } from "@/components/chapter/ConceptCards";

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

function readCache(key: string): QuizQuestion[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as QuizQuestion[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function ChapterQuiz() {
  const { gradeId, chapterId } = Route.useParams();
  const grade = Number(gradeId);
  const cId = Number(chapterId);
  const chapter = getChapter(grade, cId)!;
  const theme = getTheme(grade);
  const { recordChapterResult } = useProgress();
  const generate = useServerFn(generateChapterQuiz);
  const queryClient = useQueryClient();

  const cacheKey = `${CACHE_PREFIX}${grade}-${cId}`;
  const queryKey = ["chapter-quiz", grade, cId] as const;

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await generate({ data: { grade, chapterTitle: chapter.title, count: 25 } });
      const qs = res.questions as QuizQuestion[];
      try { localStorage.setItem(cacheKey, JSON.stringify(qs)); } catch { /* ignore */ }
      return qs;
    },
    initialData: () => readCache(cacheKey),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  function regenerate() {
    try { localStorage.removeItem(cacheKey); } catch { /* ignore */ }
    queryClient.removeQueries({ queryKey });
    refetch();
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
        {data && (
          <button
            onClick={regenerate}
            disabled={isFetching}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> New set
          </button>
        )}
      </div>

      {isPending && !data && (
        <div className="bg-card shadow-card mx-auto max-w-2xl rounded-3xl p-10 text-center">
          <div className="border-primary mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
          <p className="font-bold">HBK Mathy is preparing your 25 questions…</p>
          <p className="text-muted-foreground mt-1 text-sm">{chapter.title}</p>
        </div>
      )}

      {isError && !data && (
        <div className="bg-destructive/10 text-destructive mx-auto max-w-2xl rounded-2xl p-6 text-center">
          <p className="font-bold">Couldn't generate questions.</p>
          <p className="mt-1 text-sm">{(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            className="bg-destructive text-destructive-foreground mt-4 rounded-xl px-4 py-2 font-semibold"
          >
            Try again
          </button>
        </div>
      )}

      {data && data.length > 0 && (
        <>
          <ConceptCards grade={grade} chapterId={cId} chapterTitle={chapter.title} />
          <QuizRunner
            key={cacheKey}
            questions={data}
            title={chapter.title}
            subtitle={`Grade ${grade} · ${theme.world}`}
            context={{ grade, chapterId: cId, chapterTitle: chapter.title }}
            onComplete={(score, total) => recordChapterResult(grade, cId, score, total)}
          />
        </>
      )}
    </div>
  );
}

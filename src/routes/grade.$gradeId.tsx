import { createFileRoute, Link, Outlet, notFound, useMatchRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Star, Play } from "lucide-react";
import { getChapters } from "@/data/ncert-maths";
import { getTheme } from "@/data/grade-themes";
import { useProgress } from "@/hooks/useProgress";
import { generateChapterQuiz, type QuizQuestion } from "@/lib/quiz.functions";

const CACHE_PREFIX = "hbk-quiz-cache-v1:";

export const Route = createFileRoute("/grade/$gradeId")({
  beforeLoad: ({ params }) => {
    const g = Number(params.gradeId);
    if (!Number.isInteger(g) || g < 1 || g > 10) throw notFound();
  },
  head: ({ params }) => {
    const theme = getTheme(Number(params.gradeId));
    return {
      meta: [
        { title: `Grade ${params.gradeId} NCERT Maths · ${theme.world} | HBK Maths Quest` },
        { name: "description", content: `Practice every NCERT Grade ${params.gradeId} Maths chapter with 25 mixed questions each.` },
      ],
    };
  },
  component: GradePage,
});

function GradePage() {
  const { gradeId } = Route.useParams();
  const grade = Number(gradeId);
  const theme = getTheme(grade);
  const chapters = getChapters(grade);
  const { state } = useProgress();
  const matchRoute = useMatchRoute();
  const onChildRoute = matchRoute({
    to: "/grade/$gradeId/chapter/$chapterId",
    fuzzy: true,
  });
  const queryClient = useQueryClient();
  const generate = useServerFn(generateChapterQuiz);

  if (onChildRoute) return <Outlet />;

  function prefetch(chapterId: number, chapterTitle: string) {
    const cacheKey = `${CACHE_PREFIX}${grade}-${chapterId}`;
    const queryKey = ["chapter-quiz", grade, chapterId] as const;
    if (queryClient.getQueryData(queryKey)) return;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return;
    } catch { /* ignore */ }
    queryClient.prefetchQuery({
      queryKey,
      queryFn: async () => {
        const res = await generate({ data: { grade, chapterTitle, count: 25 } });
        const qs = res.questions as QuizQuestion[];
        try { localStorage.setItem(cacheKey, JSON.stringify(qs)); } catch { /* ignore */ }
        return qs;
      },
      staleTime: Infinity,
    });
  }


  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link to="/" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> All worlds
      </Link>

      <div className={`bg-gradient-to-br shadow-card mb-6 flex items-center gap-5 rounded-3xl p-6 text-white ${theme.gradient}`}>
        <span className="text-7xl drop-shadow-lg" aria-hidden>{theme.emoji}</span>
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-90">Grade {grade}</p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{theme.world}</h1>
          <p className="mt-1 text-sm opacity-95">{chapters.length} NCERT chapters · 25 questions each</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {chapters.map((c) => {
          const prog = state.chapters[`${grade}-${c.id}`];
          const stars = prog?.stars ?? 0;
          return (
            <Link
              key={c.id}
              to="/grade/$gradeId/chapter/$chapterId"
              params={{ gradeId: String(grade), chapterId: String(c.id) }}
              onMouseEnter={() => prefetch(c.id, c.title)}
              onFocus={() => prefetch(c.id, c.title)}
              onTouchStart={() => prefetch(c.id, c.title)}
              className="bg-card shadow-card hover:border-primary group flex items-center gap-4 rounded-2xl border-2 border-transparent p-4 transition"
            >
              <div className={`bg-gradient-to-br ${theme.gradient} flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-extrabold text-white`}>
                {c.id}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{c.title}</p>
                <div className="mt-1 flex items-center gap-0.5">
                  {[1, 2, 3].map((s) => (
                    <Star
                      key={s}
                      className={`h-3.5 w-3.5 ${s <= stars ? "text-warning fill-current" : "text-border"}`}
                    />
                  ))}
                  {prog && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      Best {prog.best}/{prog.total}
                    </span>
                  )}
                </div>
              </div>
              <Play className="text-muted-foreground group-hover:text-primary h-5 w-5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

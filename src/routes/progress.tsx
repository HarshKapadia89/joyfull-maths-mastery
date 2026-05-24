import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Star, Sparkles, Flame, RotateCcw, Target } from "lucide-react";
import { useProgress } from "@/hooks/useProgress";
import { GRADE_THEMES } from "@/data/grade-themes";
import { getChapters } from "@/data/ncert-maths";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "My Progress | HBK Maths Quest" },
      { name: "description", content: "Track your NCERT Maths stars, XP and streak across grades 1 to 10." },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const { state, reset } = useProgress();

  // Compute weak topics: chapters with >= 5 asked, sorted by accuracy ascending
  type Weak = { grade: number; chapterId: number; chapterTitle: string; accuracy: number; asked: number };
  const weakTopics: Weak[] = [];
  for (const t of GRADE_THEMES) {
    const chapters = getChapters(t.grade);
    for (const c of chapters) {
      const p = state.chapters[`${t.grade}-${c.id}`];
      if (!p?.asked || p.asked < 5) continue;
      const accuracy = (p.correct ?? 0) / p.asked;
      weakTopics.push({ grade: t.grade, chapterId: c.id, chapterTitle: c.title, accuracy, asked: p.asked });
    }
  }
  weakTopics.sort((a, b) => a.accuracy - b.accuracy);
  const focusAreas = weakTopics.filter((w) => w.accuracy < 0.8).slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link to="/" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <div className="bg-gradient-hero shadow-glow mb-6 rounded-3xl p-6 text-white">
        <h1 className="text-3xl font-extrabold">My Progress</h1>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/15 p-4">
            <Star className="mb-1 h-5 w-5" />
            <p className="text-2xl font-extrabold">{state.totalStars}</p>
            <p className="text-xs opacity-90">Stars</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-4">
            <Sparkles className="mb-1 h-5 w-5" />
            <p className="text-2xl font-extrabold">{state.xp}</p>
            <p className="text-xs opacity-90">XP</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-4">
            <Flame className="mb-1 h-5 w-5" />
            <p className="text-2xl font-extrabold">{state.streak}</p>
            <p className="text-xs opacity-90">Streak</p>
          </div>
        </div>
      </div>

      {focusAreas.length > 0 && (
        <div className="bg-card shadow-card mb-6 rounded-3xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <Target className="text-primary h-5 w-5" />
            <h2 className="text-lg font-extrabold">Focus areas</h2>
          </div>
          <p className="text-muted-foreground mb-4 text-sm">
            These chapters need a little more love. Tap to practise.
          </p>
          <div className="space-y-3">
            {focusAreas.map((w) => {
              const pct = Math.round(w.accuracy * 100);
              return (
                <Link
                  key={`${w.grade}-${w.chapterId}`}
                  to="/grade/$gradeId/chapter/$chapterId"
                  params={{ gradeId: String(w.grade), chapterId: String(w.chapterId) }}
                  className="bg-secondary/40 hover:bg-secondary block rounded-2xl p-4 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
                        Grade {w.grade}
                      </p>
                      <p className="truncate font-extrabold">{w.chapterTitle}</p>
                    </div>
                    <p className={`text-lg font-extrabold ${pct < 50 ? "text-destructive" : "text-primary"}`}>
                      {pct}%
                    </p>
                  </div>
                  <div className="bg-background mt-2 h-2 overflow-hidden rounded-full">
                    <div
                      className={`h-full ${pct < 50 ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {GRADE_THEMES.map((t) => {
          const chapters = getChapters(t.grade);
          const cleared = chapters.filter((c) => (state.chapters[`${t.grade}-${c.id}`]?.stars ?? 0) > 0).length;
          const stars = chapters.reduce((sum, c) => sum + (state.chapters[`${t.grade}-${c.id}`]?.stars ?? 0), 0);
          return (
            <Link
              key={t.grade}
              to="/grade/$gradeId"
              params={{ gradeId: String(t.grade) }}
              className="bg-card shadow-card flex items-center gap-4 rounded-2xl p-4 transition hover:scale-[1.01]"
            >
              <span className={`bg-gradient-to-br ${t.gradient} flex h-12 w-12 items-center justify-center rounded-xl text-2xl`}>{t.emoji}</span>
              <div className="flex-1">
                <p className="font-extrabold">Grade {t.grade} · {t.world}</p>
                <p className="text-muted-foreground text-sm">
                  {cleared}/{chapters.length} chapters · {stars} stars
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <button
        onClick={() => { if (confirm("Reset all progress?")) reset(); }}
        className="text-muted-foreground hover:text-destructive mt-6 inline-flex items-center gap-1 text-sm font-semibold"
      >
        <RotateCcw className="h-4 w-4" /> Reset progress
      </button>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { Star, ArrowRight } from "lucide-react";
import { GRADE_THEMES } from "@/data/grade-themes";
import { getChapters } from "@/data/ncert-maths";
import type { ProgressState } from "@/hooks/useProgress";

export function GradeCard({ grade, progress }: { grade: number; progress: ProgressState }) {
  const theme = GRADE_THEMES.find((t) => t.grade === grade)!;
  const chapters = getChapters(grade);
  const completed = chapters.filter(
    (c) => (progress.chapters[`${grade}-${c.id}`]?.stars ?? 0) > 0,
  ).length;
  const totalChapters = chapters.length;

  return (
    <Link
      to="/grade/$gradeId"
      params={{ gradeId: String(grade) }}
      className={`group bg-gradient-to-br shadow-card relative flex aspect-[3/4] flex-col overflow-hidden rounded-3xl p-5 text-white transition hover:scale-[1.02] hover:shadow-lg ${theme.gradient}`}
    >
      <p className="text-[10px] font-semibold tracking-[0.22em] uppercase opacity-90">
        Grade {grade}
      </p>
      <h3 className="text-2xl leading-tight font-extrabold">{theme.world}</h3>

      <div className="flex flex-1 items-center justify-center">
        <span className="text-8xl drop-shadow-lg transition group-hover:scale-110" aria-hidden>
          {theme.emoji}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-xl bg-white/15 px-3 py-2 backdrop-blur-sm">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Star className="h-4 w-4 fill-current" />
            {completed}/{totalChapters}
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold">
            Chapters <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

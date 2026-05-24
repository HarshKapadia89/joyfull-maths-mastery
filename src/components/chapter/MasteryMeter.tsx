import { useEffect, useState } from "react";
import { getChapterMastery, pct, suggestDifficulty } from "@/lib/mastery";
import { Target } from "lucide-react";

const LABELS = ["Easy", "Medium", "Hard"] as const;
const KEYS = ["easy", "medium", "hard"] as const;

export function MasteryMeter({ grade, chapterId }: { grade: number; chapterId: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const m = getChapterMastery(grade, chapterId);
  if (m.overall.total === 0) return null;
  const next = suggestDifficulty(grade, chapterId);

  return (
    <div className="bg-card shadow-card mb-4 rounded-3xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="text-primary h-4 w-4" />
          <p className="font-extrabold">Your mastery</p>
        </div>
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          Next set · {next}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k, i) => {
          const cell = m[k];
          const p = pct(cell);
          return (
            <div key={k} className="bg-secondary/40 rounded-2xl p-3">
              <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
                {LABELS[i]}
              </p>
              <p className="text-xl font-extrabold">{p}%</p>
              <div className="bg-background mt-2 h-1.5 overflow-hidden rounded-full">
                <div
                  className={`h-full ${p >= 75 ? "bg-success" : p >= 40 ? "bg-primary" : "bg-destructive"}`}
                  style={{ width: `${p}%` }}
                />
              </div>
              <p className="text-muted-foreground mt-1 text-[10px]">
                {cell.right}/{cell.total} correct
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, AlertTriangle, Sparkles } from "lucide-react";
import { loadMistakes, type StoredMistake } from "@/hooks/useProgress";
import { summarizeMisconceptions, type Misconception } from "@/lib/quiz.functions";

export const Route = createFileRoute("/misconceptions")({
  head: () => ({ meta: [
    { title: "My Misconceptions · Learn from mistakes | HBK Maths Quest" },
    { name: "description", content: "AI-powered analysis of your recent NCERT Maths mistakes — find the patterns and fix them." },
  ] }),
  component: MisconceptionsPage,
});

function MisconceptionsPage() {
  const [mistakes, setMistakes] = useState<StoredMistake[]>([]);
  const [clusters, setClusters] = useState<Misconception[] | null>(null);
  const summarize = useServerFn(summarizeMisconceptions);

  useEffect(() => { setMistakes(loadMistakes()); }, []);

  const mut = useMutation({
    mutationFn: async () => {
      if (!mistakes.length) throw new Error("No mistakes saved yet.");
      const grade = mistakes[0].grade;
      return summarize({ data: {
        grade,
        mistakes: mistakes.slice(0, 30).map((m) => ({
          prompt: m.question.prompt, studentAnswer: m.studentAnswer, correctAnswer: m.question.answer, chapterTitle: m.chapterTitle,
        })),
      } });
    },
    onSuccess: (r) => setClusters(r.clusters),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <div className="bg-gradient-learn shadow-glow mb-6 rounded-3xl p-6 text-white">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-90">Learn from mistakes</p>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold"><AlertTriangle className="h-7 w-7" /> My Misconceptions</h1>
        <p className="mt-1 text-sm opacity-90">HBK Mathy reads your mistake bank and surfaces the patterns.</p>
      </div>

      {mistakes.length === 0 ? (
        <div className="bg-card shadow-card rounded-3xl p-10 text-center">
          <p className="text-2xl">🎉</p>
          <p className="mt-2 text-lg font-extrabold">No mistakes saved yet</p>
          <p className="text-muted-foreground mt-1 text-sm">Play a quiz first — wrong answers will be analysed here.</p>
        </div>
      ) : (
        <>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold disabled:opacity-50">
            <Sparkles className="h-4 w-4" />
            {mut.isPending ? "Analysing your mistakes…" : clusters ? "Re-analyse mistakes" : `Analyse my ${mistakes.length} mistakes`}
          </button>
          {mut.isError && <p className="text-destructive text-sm font-semibold">{(mut.error as Error).message}</p>}

          {clusters && (
            <div className="space-y-3">
              {clusters.map((c, i) => (
                <div key={i} className="bg-card shadow-card rounded-2xl p-5">
                  <p className="text-primary text-[10px] font-bold tracking-[0.18em] uppercase">Pattern {i + 1}</p>
                  <p className="text-lg font-extrabold">{c.title}</p>
                  <p className="text-muted-foreground mt-2 text-sm"><span className="text-foreground font-bold">Why: </span>{c.why}</p>
                  <p className="mt-2 text-sm"><span className="font-bold">Fix: </span>{c.fix}</p>
                  <p className="bg-success/10 text-success mt-3 rounded-xl px-3 py-2 text-xs font-semibold">💡 {c.practiceTip}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

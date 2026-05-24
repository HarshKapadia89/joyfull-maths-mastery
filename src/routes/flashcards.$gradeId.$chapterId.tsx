import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { getChapter } from "@/data/ncert-maths";
import { generateFormulaSheet } from "@/lib/quiz.functions";

export const Route = createFileRoute("/flashcards/$gradeId/$chapterId")({
  beforeLoad: ({ params }) => {
    const g = Number(params.gradeId); const c = Number(params.chapterId);
    if (!Number.isInteger(g) || g < 1 || g > 10) throw notFound();
    if (!getChapter(g, c)) throw notFound();
  },
  head: ({ params }) => {
    const ch = getChapter(Number(params.gradeId), Number(params.chapterId));
    return { meta: [
      { title: `${ch?.title ?? "Flashcards"} · Formula Flashcards | HBK Maths Quest` },
      { name: "description", content: `Flip-card revision for ${ch?.title} formulas — Grade ${params.gradeId} NCERT.` },
    ] };
  },
  component: Flashcards,
});

function Flashcards() {
  const { gradeId, chapterId } = Route.useParams();
  const grade = Number(gradeId); const cId = Number(chapterId);
  const chapter = getChapter(grade, cId)!;
  const gen = useServerFn(generateFormulaSheet);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const q = useQuery({
    queryKey: ["flashcards", grade, cId],
    queryFn: async () => (await gen({ data: { grade, chapterTitle: chapter.title } })).formulas,
    staleTime: Infinity,
  });

  const cards = q.data ?? [];
  const card = cards[i];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link to="/grade/$gradeId/chapter/$chapterId" params={{ gradeId, chapterId }}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to {chapter.title}
      </Link>
      <h1 className="mb-1 text-2xl font-extrabold">Formula Flashcards</h1>
      <p className="text-muted-foreground mb-6 text-sm">Grade {grade} · {chapter.title}</p>

      {q.isPending && <div className="bg-card shadow-card rounded-3xl p-10 text-center"><div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" /></div>}
      {q.isError && <p className="text-destructive font-semibold">{(q.error as Error).message}</p>}

      {card && (
        <>
          <p className="text-muted-foreground mb-3 text-center text-xs font-bold tracking-[0.18em] uppercase">
            Card {i + 1} / {cards.length} · {flipped ? "Tap to hide answer" : "Tap to reveal"}
          </p>
          <button onClick={() => setFlipped((f) => !f)}
            className={`bg-card shadow-card relative flex min-h-[280px] w-full items-center justify-center rounded-3xl p-8 text-center transition ${flipped ? "border-success border-4" : "border-primary/30 border-4"}`}>
            {!flipped ? (
              <div>
                <p className="text-muted-foreground text-xs font-bold tracking-[0.2em] uppercase">Formula name</p>
                <p className="mt-3 text-3xl font-extrabold">{card.name}</p>
                <p className="text-muted-foreground mt-6 text-sm italic">{card.whenToUse}</p>
              </div>
            ) : (
              <div>
                <p className="text-success text-xs font-bold tracking-[0.2em] uppercase">Formula</p>
                <p className="mt-4 font-mono text-2xl font-extrabold">{card.formula}</p>
                <p className="text-muted-foreground mt-6 text-sm">{card.name}</p>
              </div>
            )}
          </button>
          <div className="mt-5 flex items-center justify-between">
            <button disabled={i === 0} onClick={() => { setI((x) => x - 1); setFlipped(false); }}
              className="border-border inline-flex items-center gap-1 rounded-xl border-2 px-4 py-2 font-bold disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button onClick={() => { setI(0); setFlipped(false); }}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-semibold">
              <RotateCcw className="h-4 w-4" /> Restart
            </button>
            <button disabled={i + 1 >= cards.length} onClick={() => { setI((x) => x + 1); setFlipped(false); }}
              className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-xl px-4 py-2 font-bold disabled:opacity-40">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

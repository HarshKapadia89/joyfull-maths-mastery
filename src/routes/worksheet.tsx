import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, FileDown, Sparkles } from "lucide-react";
import { GRADE_THEMES } from "@/data/grade-themes";
import { getChapters } from "@/data/ncert-maths";
import { generateWorksheet, type WorksheetItem } from "@/lib/quiz.functions";
import { downloadWorksheetPdf } from "@/lib/pdf/worksheetPdf";

export const Route = createFileRoute("/worksheet")({
  head: () => ({
    meta: [
      { title: "Worksheet Generator · Printable NCERT Maths | HBK Maths Quest" },
      { name: "description", content: "Generate printable NCERT Maths worksheets with student and teacher copies." },
    ],
  }),
  component: WorksheetPage,
});

function WorksheetPage() {
  const gen = useServerFn(generateWorksheet);
  const [grade, setGrade] = useState(5);
  const [chapterId, setChapterId] = useState(1);
  const [count, setCount] = useState(10);
  const [name, setName] = useState("");
  const [items, setItems] = useState<WorksheetItem[] | null>(null);
  const chapters = useMemo(() => getChapters(grade), [grade]);
  const chapter = chapters.find((c) => c.id === chapterId) ?? chapters[0];

  const mut = useMutation({
    mutationFn: async () => gen({ data: { grade, chapterTitle: chapter.title, count } }),
    onSuccess: (res) => setItems(res.items),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link to="/" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <div className="bg-gradient-custom shadow-glow mb-6 rounded-3xl p-6 text-white">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-90">Printable</p>
        <h1 className="text-3xl font-extrabold">Worksheet Generator</h1>
        <p className="mt-1 text-sm opacity-90">Open-ended NCERT questions, branded HBK PDF, with optional answer key.</p>
      </div>

      <div className="bg-card shadow-card space-y-4 rounded-3xl p-6">
        <label className="block">
          <span className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">Student name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riya Patel"
            className="border-border bg-card mt-1 w-full rounded-xl border-2 px-4 py-3 font-semibold outline-none" />
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">Grade</span>
          <select value={grade} onChange={(e) => { setGrade(Number(e.target.value)); setChapterId(1); }}
            className="border-border bg-card mt-1 w-full rounded-xl border-2 px-4 py-3 font-semibold outline-none">
            {GRADE_THEMES.map((t) => <option key={t.grade} value={t.grade}>Grade {t.grade} · {t.world}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">Chapter</span>
          <select value={chapterId} onChange={(e) => setChapterId(Number(e.target.value))}
            className="border-border bg-card mt-1 w-full rounded-xl border-2 px-4 py-3 font-semibold outline-none">
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.id}. {c.title}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">Questions: {count}</span>
          <input type="range" min={5} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-2 w-full" />
        </label>

        <button onClick={() => mut.mutate()} disabled={mut.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold disabled:opacity-50">
          <Sparkles className="h-4 w-4" />
          {mut.isPending ? "Generating worksheet…" : "Generate worksheet"}
        </button>
        {mut.isError && <p className="text-destructive text-sm font-semibold">{(mut.error as Error).message}</p>}

        {items && (
          <div className="border-border space-y-3 rounded-2xl border-2 p-4">
            <p className="text-sm font-bold">{items.length} questions ready · {items.reduce((s, i) => s + i.marks, 0)} marks total</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => downloadWorksheetPdf({ grade, chapterTitle: chapter.title, items, studentName: name || undefined })}
                className="bg-foreground text-background inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold">
                <FileDown className="h-4 w-4" /> Student copy
              </button>
              <button onClick={() => downloadWorksheetPdf({ grade, chapterTitle: chapter.title, items, includeAnswers: true, studentName: name || undefined })}
                className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold">
                <FileDown className="h-4 w-4" /> Teacher copy + answers
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

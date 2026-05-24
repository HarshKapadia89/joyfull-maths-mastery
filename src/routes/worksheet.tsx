import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckSquare, FileDown, Sparkles, Square } from "lucide-react";
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
  const [selectedIds, setSelectedIds] = useState<number[]>([1]);
  const [totalMarks, setTotalMarks] = useState(30);
  const [name, setName] = useState("");
  const [items, setItems] = useState<WorksheetItem[] | null>(null);
  const chapters = useMemo(() => getChapters(grade), [grade]);

  const selectedChapters = useMemo(
    () => chapters.filter((c) => selectedIds.includes(c.id)),
    [chapters, selectedIds],
  );

  const allSelected = selectedIds.length === chapters.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < chapters.length;

  const toggleChapter = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAll = () => setSelectedIds(chapters.map((c) => c.id));
  const deselectAll = () => setSelectedIds([]);

  const mut = useMutation({
    mutationFn: async () =>
      gen({
        data: {
          grade,
          chapterTitles: selectedChapters.map((c) => c.title),
          totalMarks,
        },
      }),
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
          <select value={grade} onChange={(e) => { setGrade(Number(e.target.value)); setSelectedIds([1]); }}
            className="border-border bg-card mt-1 w-full rounded-xl border-2 px-4 py-3 font-semibold outline-none">
            {GRADE_THEMES.map((t) => <option key={t.grade} value={t.grade}>Grade {t.grade} · {t.world}</option>)}
          </select>
        </label>

        {/* Chapter multi-select with check/uncheck all */}
        <div className="block">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">
              Chapters ({selectedIds.length} selected)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-bold"
              >
                <CheckSquare className="h-3.5 w-3.5" /> Select all
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-bold"
              >
                <Square className="h-3.5 w-3.5" /> Deselect all
              </button>
            </div>
          </div>
          <div className="border-border bg-card mt-2 max-h-56 overflow-y-auto rounded-xl border-2 p-2">
            {chapters.map((c) => {
              const checked = selectedIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    checked ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleChapter(c.id)}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  <span className="flex-1">{c.id}. {c.title}</span>
                </label>
              );
            })}
          </div>
          {selectedIds.length === 1 && someSelected && (
            <p className="text-muted-foreground mt-1 text-xs">
              Multi-chapter worksheets distribute questions across selected chapters.
            </p>
          )}
        </div>

        <label className="block">
          <span className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">Total marks: {totalMarks}</span>
          <input type="range" min={5} max={100} step={5} value={totalMarks} onChange={(e) => setTotalMarks(Number(e.target.value))} className="mt-2 w-full" />
          <p className="text-muted-foreground mt-1 text-xs">Questions are auto-sized (1–5 marks each) to total exactly {totalMarks} marks.</p>
        </label>

        <button onClick={() => mut.mutate()} disabled={mut.isPending || selectedIds.length === 0}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold disabled:opacity-50">
          <Sparkles className="h-4 w-4" />
          {mut.isPending ? "Generating worksheet…" : "Generate worksheet"}
        </button>
        {mut.isError && <p className="text-destructive text-sm font-semibold">{(mut.error as Error).message}</p>}

        {items && (
          <div className="border-border space-y-3 rounded-2xl border-2 p-4">
            <p className="text-sm font-bold">{items.length} questions ready · {items.reduce((s, i) => s + i.marks, 0)} marks total</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => downloadWorksheetPdf({ grade, chapterTitles: selectedChapters.map((c) => c.title), items, studentName: name || undefined })}
                className="bg-foreground text-background inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold">
                <FileDown className="h-4 w-4" /> Student copy
              </button>
              <button onClick={() => downloadWorksheetPdf({ grade, chapterTitles: selectedChapters.map((c) => c.title), items, includeAnswers: true, studentName: name || undefined })}
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

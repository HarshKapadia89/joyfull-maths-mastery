import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Calculator,
  Zap,
  Layers,
  Download,
  FileDown,
  Map,
  BookText,
  GraduationCap,
} from "lucide-react";
import {
  generateConceptCards,
  generateFormulaSheet,
  type ConceptCard,
  type Formula,
} from "@/lib/quiz.functions";
import {
  downloadConceptCardsPdf,
  downloadFormulaSheetPdf,
  downloadRevisionPackPdf,
} from "@/lib/pdf/revisionPdf";
import { LearningPathway, SolvedExamples, ExamCorner } from "@/components/chapter/DeepLearning";

const CARDS_PREFIX = "hbk-concepts-v3:";
const FORMULAS_PREFIX = "hbk-formulas-v2:";

function readJSON<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

type Tab = "pathway" | "cards" | "formulas" | "solved" | "exam";
type Depth = "quick" | "deep";

export function ConceptCards({
  grade,
  chapterId,
  chapterTitle,
}: {
  grade: number;
  chapterId: number;
  chapterTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("pathway");
  const [depth, setDepth] = useState<Depth>("quick");
  const [packLoading, setPackLoading] = useState(false);

  const genCards = useServerFn(generateConceptCards);
  const genFormulas = useServerFn(generateFormulaSheet);
  const queryClient = useQueryClient();

  const cardsKey = `${CARDS_PREFIX}${grade}-${chapterId}-${depth}`;
  const formulasKey = `${FORMULAS_PREFIX}${grade}-${chapterId}`;

  const cardsQ = useQuery({
    queryKey: ["concepts", grade, chapterId, depth],
    queryFn: async () => {
      const res = await genCards({ data: { grade, chapterTitle, depth } });
      try { localStorage.setItem(cardsKey, JSON.stringify(res.cards)); } catch { /* ignore */ }
      return res.cards;
    },
    initialData: () => readJSON<ConceptCard[]>(cardsKey),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: open && tab === "cards",
    retry: 1,
  });

  const formulasQ = useQuery({
    queryKey: ["formulas", grade, chapterId],
    queryFn: async () => {
      const res = await genFormulas({ data: { grade, chapterTitle } });
      try { localStorage.setItem(formulasKey, JSON.stringify(res.formulas)); } catch { /* ignore */ }
      return res.formulas;
    },
    initialData: () => readJSON<Formula[]>(formulasKey),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: open && tab === "formulas",
    retry: 1,
  });

  async function ensureCards(d: Depth): Promise<ConceptCard[]> {
    const key = `${CARDS_PREFIX}${grade}-${chapterId}-${d}`;
    const cached = readJSON<ConceptCard[]>(key);
    if (cached) return cached;
    const res = await queryClient.fetchQuery({
      queryKey: ["concepts", grade, chapterId, d],
      queryFn: async () => {
        const r = await genCards({ data: { grade, chapterTitle, depth: d } });
        try { localStorage.setItem(key, JSON.stringify(r.cards)); } catch { /* ignore */ }
        return r.cards;
      },
    });
    return res;
  }

  async function ensureFormulas(): Promise<Formula[]> {
    const cached = readJSON<Formula[]>(formulasKey);
    if (cached) return cached;
    const res = await queryClient.fetchQuery({
      queryKey: ["formulas", grade, chapterId],
      queryFn: async () => {
        const r = await genFormulas({ data: { grade, chapterTitle } });
        try { localStorage.setItem(formulasKey, JSON.stringify(r.formulas)); } catch { /* ignore */ }
        return r.formulas;
      },
    });
    return res;
  }

  async function handleDownloadPack() {
    setPackLoading(true);
    try {
      // Always pull the deep set for the printable pack
      const [cards, formulas] = await Promise.all([ensureCards("deep"), ensureFormulas()]);
      downloadRevisionPackPdf({ grade, chapterTitle, cards, formulas });
    } catch (e) {
      console.error(e);
      alert("Couldn't build the revision pack. Please try again.");
    } finally {
      setPackLoading(false);
    }
  }

  async function handleDownloadCards() {
    try {
      const cards = await ensureCards(depth);
      downloadConceptCardsPdf({ grade, chapterTitle, cards });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDownloadFormulas() {
    try {
      const formulas = await ensureFormulas();
      downloadFormulaSheetPdf({ grade, chapterTitle, formulas });
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="bg-card shadow-card mb-4 rounded-3xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-5"
      >
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
            <BookOpen className="h-5 w-5" />
          </span>
          <div className="text-left">
            <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
              Learn first · revise smart
            </p>
            <p className="font-extrabold">Learning pathway, cards, formulas, solved examples &amp; exam corner</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>

      {open && (
        <div className="px-5 pb-5">
          {/* Primary PDF action */}
          <button
            onClick={handleDownloadPack}
            disabled={packLoading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold disabled:opacity-60"
          >
            {packLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Building HBK Revision Pack…
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Download HBK Revision Pack (PDF)
              </>
            )}
          </button>

          {/* Tabs */}
          <div className="bg-secondary mb-4 flex flex-wrap gap-1 rounded-xl p-1">
            <button
              onClick={() => setTab("pathway")}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === "pathway" ? "bg-card text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              <Map className="h-3.5 w-3.5" /> Learning pathway
            </button>
            <button
              onClick={() => setTab("cards")}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === "cards" ? "bg-card text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5" /> Concept cards
            </button>
            <button
              onClick={() => setTab("formulas")}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === "formulas" ? "bg-card text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              <Calculator className="h-3.5 w-3.5" /> Formula sheet
            </button>
            <button
              onClick={() => setTab("solved")}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === "solved" ? "bg-card text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              <BookText className="h-3.5 w-3.5" /> Solved examples
            </button>
            <button
              onClick={() => setTab("exam")}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === "exam" ? "bg-card text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" /> Exam corner
            </button>
          </div>

          {tab === "pathway" && (
            <LearningPathway grade={grade} chapterId={chapterId} chapterTitle={chapterTitle} />
          )}

          {tab === "solved" && (
            <SolvedExamples grade={grade} chapterId={chapterId} chapterTitle={chapterTitle} />
          )}

          {tab === "exam" && (
            <ExamCorner grade={grade} chapterId={chapterId} chapterTitle={chapterTitle} />
          )}

          {tab === "cards" && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
                    Depth
                  </span>
                  <div className="bg-secondary inline-flex rounded-lg p-0.5">
                    <button
                      onClick={() => setDepth("quick")}
                      className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                        depth === "quick" ? "bg-card shadow" : "text-muted-foreground"
                      }`}
                    >
                      Quick (4)
                    </button>
                    <button
                      onClick={() => setDepth("deep")}
                      className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                        depth === "deep" ? "bg-card shadow" : "text-muted-foreground"
                      }`}
                    >
                      Deep dive (8)
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleDownloadCards}
                  disabled={!cardsQ.data}
                  className="text-primary inline-flex items-center gap-1 text-xs font-bold disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" /> Cards PDF
                </button>
              </div>

              {cardsQ.isPending && !cardsQ.data && (
                <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm font-semibold">
                  <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                  Preparing concept cards…
                </div>
              )}
              {cardsQ.isError && !cardsQ.data && (
                <p className="text-destructive text-sm font-semibold">
                  {(cardsQ.error as Error).message}
                </p>
              )}
              {cardsQ.data && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {cardsQ.data.map((c, i) => (
                    <div key={i} className="bg-secondary/40 rounded-2xl p-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="text-primary h-4 w-4" />
                        <p className="font-extrabold">{c.title}</p>
                      </div>
                      <p className="mt-2 text-sm">
                        <span className="font-bold">Key idea: </span>
                        {c.keyIdea}
                      </p>
                      <p className="mt-2 text-sm">
                        <span className="font-bold">Example: </span>
                        {c.example}
                      </p>
                      <p className="text-muted-foreground mt-2 text-sm">
                        <span className="font-bold">Watch out: </span>
                        {c.pitfall}
                      </p>
                      {c.derivation && (
                        <p className="bg-card mt-2 rounded-lg p-2 text-xs">
                          <span className="font-extrabold">{grade >= 8 ? "Derivation" : "Why it works"}: </span>
                          {c.derivation}
                        </p>
                      )}
                      {c.prerequisites && (
                        <p className="text-muted-foreground mt-2 text-xs">
                          <span className="font-bold">Prerequisites: </span>
                          {c.prerequisites}
                        </p>
                      )}
                      {c.relatedTopics && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          <span className="font-bold">Related: </span>
                          {c.relatedTopics}
                        </p>
                      )}
                      {c.examTip && (
                        <p className="bg-primary/10 text-primary mt-2 flex items-start gap-1.5 rounded-lg p-2 text-xs font-semibold">
                          <Zap className="mt-0.5 h-3 w-3 flex-none" />
                          <span>
                            <span className="font-extrabold">Exam tip: </span>
                            {c.examTip}
                          </span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "formulas" && (
            <>
              <div className="mb-3 flex items-center justify-end">
                <button
                  onClick={handleDownloadFormulas}
                  disabled={!formulasQ.data}
                  className="text-primary inline-flex items-center gap-1 text-xs font-bold disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" /> Formula sheet PDF
                </button>
              </div>
              {formulasQ.isPending && !formulasQ.data && (
                <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm font-semibold">
                  <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                  Building formula sheet…
                </div>
              )}
              {formulasQ.isError && !formulasQ.data && (
                <p className="text-destructive text-sm font-semibold">
                  {(formulasQ.error as Error).message}
                </p>
              )}
              {formulasQ.data && (
                <div className="border-border overflow-hidden rounded-2xl border-2">
                  {formulasQ.data.map((f, i) => (
                    <div
                      key={i}
                      className="border-border grid grid-cols-1 gap-1 border-b p-3 last:border-b-0 sm:grid-cols-[1fr_1.2fr_1.5fr] sm:items-center sm:gap-3"
                    >
                      <p className="text-sm font-extrabold">{f.name}</p>
                      <p className="bg-secondary rounded-lg px-3 py-1.5 font-mono text-sm">
                        {f.formula}
                      </p>
                      <p className="text-muted-foreground text-xs">{f.whenToUse}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

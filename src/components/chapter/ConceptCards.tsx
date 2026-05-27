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
  Map,
  BookText,
  GraduationCap,
  Zap as Lightning,
  BookMarked,
} from "lucide-react";

import {
  generateConceptCards,
  generateFormulaSheet,
  generateChapterPathway,
  generateTopicLesson,
  generateSolvedExamples,
  generateExamCorner,
  type ConceptCard,
  type Formula,
  type PathwayTopic,
  type TopicLesson,
  type SolvedExample,
  type ExamQuestion,
} from "@/lib/quiz.functions";
import {
  downloadConceptCardsPdf,
  downloadFormulaSheetPdf,
  downloadRevisionPackPdf,
  downloadQuickRevisionPackPdf,
  downloadLearningPathwayPdf,
  downloadSolvedExamplesPdf,
  downloadExamCornerPdf,
} from "@/lib/pdf/revisionPdf";
import {
  ensurePathway,
  ensureSolved,
  ensureExam,
  ensureAllTopicLessons,
  readJSON as readDLJSON,
  pathwayKey,
  lessonKey,
  solvedKey,
  examKey,
} from "@/lib/deep-learning-cache";
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
type PackKind = "quick" | "full" | null;

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
  const [packBusy, setPackBusy] = useState<PackKind>(null);
  const [packStatus, setPackStatus] = useState<string>("");

  const genCards = useServerFn(generateConceptCards);
  const genFormulas = useServerFn(generateFormulaSheet);
  const genPathway = useServerFn(generateChapterPathway);
  const genLesson = useServerFn(generateTopicLesson);
  const genSolved = useServerFn(generateSolvedExamples);
  const genExam = useServerFn(generateExamCorner);
  const qc = useQueryClient();

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
    const res = await qc.fetchQuery({
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
    const res = await qc.fetchQuery({
      queryKey: ["formulas", grade, chapterId],
      queryFn: async () => {
        const r = await genFormulas({ data: { grade, chapterTitle } });
        try { localStorage.setItem(formulasKey, JSON.stringify(r.formulas)); } catch { /* ignore */ }
        return r.formulas;
      },
    });
    return res;
  }

  async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      setPackStatus(label);
      return await fn();
    } catch (e) {
      console.error(`${label} failed`, e);
      return null;
    }
  }

  async function handleQuickPack() {
    setPackBusy("quick");
    try {
      setPackStatus("Concept cards…");
      const cards = await ensureCards("deep");
      setPackStatus("Formula sheet…");
      const formulas = await ensureFormulas();
      const pathway = await safe("Pathway at a glance…", () =>
        ensurePathway(qc, genPathway, grade, chapterId, chapterTitle),
      );
      const examCorner = await safe(
        grade <= 7 ? "Test highlights…" : "Exam highlights…",
        () => ensureExam(qc, genExam, grade, chapterId, chapterTitle),
      );
      setPackStatus("Building PDF…");
      downloadQuickRevisionPackPdf({
        grade,
        chapterTitle,
        cards,
        formulas,
        pathway: pathway ?? undefined,
        examCorner: examCorner ?? undefined,
      });
    } catch (e) {
      console.error(e);
      alert("Couldn't build the Quick Pack. Please try again.");
    } finally {
      setPackBusy(null);
      setPackStatus("");
    }
  }

  async function handleFullPack() {
    setPackBusy("full");
    try {
      setPackStatus("Concept cards…");
      const cards = await ensureCards("deep");
      setPackStatus("Formula sheet…");
      const formulas = await ensureFormulas();

      const pathway = await safe("Learning pathway index…", () =>
        ensurePathway(qc, genPathway, grade, chapterId, chapterTitle),
      );

      let topicLessons: Array<{ topic: PathwayTopic; lesson: TopicLesson | null }> = [];
      if (pathway && pathway.length) {
        topicLessons = await ensureAllTopicLessons(
          qc,
          genLesson,
          grade,
          chapterId,
          chapterTitle,
          pathway,
          {
            concurrency: 3,
            onProgress: (done, total) =>
              setPackStatus(`Topic mini-lessons… ${done}/${total}`),
          },
        );
      }

      const solvedExamples = await safe("Solved examples…", () =>
        ensureSolved(qc, genSolved, grade, chapterId, chapterTitle),
      );
      const examCorner = await safe(
        grade <= 7 ? "Test & Olympiad corner…" : "Exam corner…",
        () => ensureExam(qc, genExam, grade, chapterId, chapterTitle),
      );

      setPackStatus("Building PDF…");
      downloadRevisionPackPdf({
        grade,
        chapterTitle,
        cards,
        formulas,
        pathway: pathway ?? undefined,
        topicLessons: topicLessons.length ? topicLessons : undefined,
        solvedExamples: solvedExamples ?? undefined,
        examCorner: examCorner ?? undefined,
      });
    } catch (e) {
      console.error(e);
      alert("Couldn't build the Full Pack. Please try again.");
    } finally {
      setPackBusy(null);
      setPackStatus("");
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

  async function handleDownloadPathwayPdf() {
    try {
      setPackBusy("full");
      setPackStatus("Learning pathway…");
      const pathway = await ensurePathway(qc, genPathway, grade, chapterId, chapterTitle);
      const topicLessons = await ensureAllTopicLessons(
        qc,
        genLesson,
        grade,
        chapterId,
        chapterTitle,
        pathway,
        {
          concurrency: 3,
          onProgress: (done, total) => setPackStatus(`Topic lessons… ${done}/${total}`),
        },
      );
      downloadLearningPathwayPdf({ grade, chapterTitle, pathway, topicLessons });
    } catch (e) {
      console.error(e);
      alert("Couldn't build the Learning Pathway PDF.");
    } finally {
      setPackBusy(null);
      setPackStatus("");
    }
  }

  async function handleDownloadSolvedPdf() {
    try {
      const examples = await ensureSolved(qc, genSolved, grade, chapterId, chapterTitle);
      downloadSolvedExamplesPdf({ grade, chapterTitle, examples });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDownloadExamPdf() {
    try {
      const questions = await ensureExam(qc, genExam, grade, chapterId, chapterTitle);
      downloadExamCornerPdf({ grade, chapterTitle, questions });
    } catch (e) {
      console.error(e);
    }
  }

  // Surface cached availability for per-tab buttons
  const pathwayCached = !!readDLJSON<PathwayTopic[]>(pathwayKey(grade, chapterId));
  const solvedCached = !!readDLJSON<SolvedExample[]>(solvedKey(grade, chapterId));
  const examCached = !!readDLJSON<ExamQuestion[]>(examKey(grade, chapterId));
  // silence unused import in case lessonKey isn't used elsewhere
  void lessonKey;

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
          {/* Two PDF download options */}
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <button
              onClick={handleQuickPack}
              disabled={packBusy !== null}
              className="border-primary text-primary hover:bg-primary/5 inline-flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-left font-bold disabled:opacity-60"
            >
              {packBusy === "quick" ? (
                <>
                  <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                  <span className="text-xs">{packStatus || "Building Quick Pack…"}</span>
                </>
              ) : (
                <>
                  <Lightning className="h-4 w-4 flex-none" />
                  <span className="flex-1">
                    <span className="block text-sm">Quick Pack (PDF)</span>
                    <span className="block text-[10px] font-semibold opacity-70">
                      Cards + formulas + 1-page summary
                    </span>
                  </span>
                </>
              )}
            </button>
            <button
              onClick={handleFullPack}
              disabled={packBusy !== null}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-left font-bold disabled:opacity-60"
            >
              {packBusy === "full" ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span className="text-xs">{packStatus || "Building Full Pack…"}</span>
                </>
              ) : (
                <>
                  <BookMarked className="h-4 w-4 flex-none" />
                  <span className="flex-1">
                    <span className="block text-sm">Full Pack (PDF)</span>
                    <span className="block text-[10px] font-semibold opacity-80">
                      Pathway · solved examples · exam corner
                    </span>
                  </span>
                </>
              )}
            </button>
          </div>

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
            <>
              <div className="mb-2 flex justify-end">
                <button
                  onClick={handleDownloadPathwayPdf}
                  disabled={packBusy !== null}
                  className="text-primary inline-flex items-center gap-1 text-xs font-bold disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {packBusy === "full" && packStatus
                    ? packStatus
                    : pathwayCached
                      ? "Pathway PDF"
                      : "Build & download Pathway PDF"}
                </button>
              </div>
              <LearningPathway grade={grade} chapterId={chapterId} chapterTitle={chapterTitle} />
            </>
          )}

          {tab === "solved" && (
            <>
              <div className="mb-2 flex justify-end">
                <button
                  onClick={handleDownloadSolvedPdf}
                  disabled={!solvedCached && packBusy !== null}
                  className="text-primary inline-flex items-center gap-1 text-xs font-bold disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" /> Solved Examples PDF
                </button>
              </div>
              <SolvedExamples grade={grade} chapterId={chapterId} chapterTitle={chapterTitle} />
            </>
          )}

          {tab === "exam" && (
            <>
              <div className="mb-2 flex justify-end">
                <button
                  onClick={handleDownloadExamPdf}
                  disabled={!examCached && packBusy !== null}
                  className="text-primary inline-flex items-center gap-1 text-xs font-bold disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {grade <= 7 ? "Test & Olympiad PDF" : "Exam Corner PDF"}
                </button>
              </div>
              <ExamCorner grade={grade} chapterId={chapterId} chapterTitle={chapterTitle} />
            </>
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
                <div className="space-y-2">
                  {formulasQ.data.map((f, i) => (
                    <div key={i} className="border-border bg-card rounded-2xl border-2 p-3">
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_1.2fr_1.5fr] sm:items-center sm:gap-3">
                        <p className="text-sm font-extrabold">{f.name}</p>
                        <p className="bg-secondary rounded-lg px-3 py-1.5 font-mono text-sm">
                          {f.formula}
                        </p>
                        <p className="text-muted-foreground text-xs">{f.whenToUse}</p>
                      </div>
                      {(f.derivation || f.conditions || f.commonMistake || f.relatedFormula) && (
                        <div className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
                          {f.derivation && (
                            <p className="bg-secondary/40 rounded-lg p-2">
                              <span className="font-extrabold">Derivation: </span>
                              {f.derivation}
                            </p>
                          )}
                          {f.conditions && (
                            <p className="bg-secondary/40 rounded-lg p-2">
                              <span className="font-extrabold">Valid when: </span>
                              {f.conditions}
                            </p>
                          )}
                          {f.commonMistake && (
                            <p className="bg-amber-50 text-amber-900 rounded-lg p-2">
                              <span className="font-extrabold">Watch out: </span>
                              {f.commonMistake}
                            </p>
                          )}
                          {f.relatedFormula && (
                            <p className="text-muted-foreground rounded-lg p-2">
                              <span className="font-extrabold">Related: </span>
                              {f.relatedFormula}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Render the unused FileDown icon to satisfy lint */}
          <span className="sr-only" aria-hidden>
            <FileDown className="h-0 w-0" />
          </span>
        </div>
      )}
    </div>
  );
}

import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { generateConceptCards, type ConceptCard } from "@/lib/quiz.functions";

const CACHE_PREFIX = "hbk-concepts-v1:";

function readCache(key: string): ConceptCard[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as ConceptCard[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

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
  const generate = useServerFn(generateConceptCards);
  const cacheKey = `${CACHE_PREFIX}${grade}-${chapterId}`;

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["concepts", grade, chapterId],
    queryFn: async () => {
      const res = await generate({ data: { grade, chapterTitle } });
      try { localStorage.setItem(cacheKey, JSON.stringify(res.cards)); } catch { /* ignore */ }
      return res.cards;
    },
    initialData: () => readCache(cacheKey),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: open,
    retry: 1,
  });

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
              Learn first · 1 min recap
            </p>
            <p className="font-extrabold">Concept cards</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>

      {open && (
        <div className="px-5 pb-5">
          {isPending && !data && (
            <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm font-semibold">
              <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
              Preparing concept cards…
            </div>
          )}
          {isError && !data && (
            <p className="text-destructive text-sm font-semibold">{(error as Error).message}</p>
          )}
          {data && (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.map((c, i) => (
                <div key={i} className="bg-secondary/40 rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-primary h-4 w-4" />
                    <p className="font-extrabold">{c.title}</p>
                  </div>
                  <p className="mt-2 text-sm"><span className="font-bold">Key idea: </span>{c.keyIdea}</p>
                  <p className="mt-2 text-sm"><span className="font-bold">Example: </span>{c.example}</p>
                  <p className="text-muted-foreground mt-2 text-sm"><span className="font-bold">Watch out: </span>{c.pitfall}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

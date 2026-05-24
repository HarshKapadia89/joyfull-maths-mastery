import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Check, X, ArrowRight, Sparkles, Lightbulb, Plus } from "lucide-react";
import type { QuizQuestion } from "@/lib/quiz.functions";
import { explainMistake, generateTwins } from "@/lib/quiz.functions";
import { addMistake, recordMistakeOutcome } from "@/hooks/useProgress";
import { recordAnswer } from "@/lib/mastery";

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

const LETTERS = ["A", "B", "C", "D"] as const;

function isValidMcq(q: QuizQuestion) {
  return (
    q.type === "mcq" &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.some((o) => normalize(o) === normalize(q.answer))
  );
}

export function QuizRunner({
  questions: rawQuestions,
  onComplete,
  title,
  subtitle,
  context,
  deadlineAt,
}: {
  questions: QuizQuestion[];
  onComplete: (score: number, total: number) => void;
  title: string;
  subtitle?: string;
  context?: {
    grade: number;
    chapterId: number;
    chapterTitle: string;
    revisionMode?: boolean;
    revisionIds?: string[];
  };
  deadlineAt?: number;
}) {
  const baseQuestions = useMemo(() => rawQuestions.filter(isValidMcq), [rawQuestions]);
  const [extraQs, setExtraQs] = useState<QuizQuestion[]>([]);
  const questions = useMemo(() => [...baseQuestions, ...extraQs], [baseQuestions, extraQs]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [input, setInput] = useState("");
  const [correct, setCorrect] = useState(false);
  const [done, setDone] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  const explain = useServerFn(explainMistake);
  const twins = useServerFn(generateTwins);

  const explainMut = useMutation({
    mutationFn: async (vars: { q: QuizQuestion; studentAnswer: string }) => {
      if (!context) throw new Error("No context");
      return explain({
        data: {
          grade: context.grade,
          chapterTitle: context.chapterTitle,
          prompt: vars.q.prompt,
          studentAnswer: vars.studentAnswer,
          correctAnswer: vars.q.answer,
        },
      });
    },
    onSuccess: (res) => setExplanation(res.explanation),
    onError: (err) => setExplanation(`⚠️ ${(err as Error).message}`),
  });

  const twinsMut = useMutation({
    mutationFn: async (q: QuizQuestion) => {
      if (!context) throw new Error("No context");
      return twins({
        data: {
          grade: context.grade,
          chapterTitle: context.chapterTitle,
          basis: { prompt: q.prompt, answer: q.answer },
          count: 3,
        },
      });
    },
    onSuccess: (res) => {
      const fresh = (res.questions as QuizQuestion[]).filter(isValidMcq);
      if (fresh.length > 0) setExtraQs((cur) => [...cur, ...fresh]);
    },
  });

  const total = questions.length;
  const q = questions[index];

  useEffect(() => {
    if (submitted && !correct && context && !explanation && !explainMut.isPending) {
      explainMut.mutate({ q, studentAnswer: input });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, correct, index]);

  function check(value: string) {
    if (submitted || !q) return;
    const isRight = normalize(value) === normalize(q.answer);
    setInput(value);
    setCorrect(isRight);
    setSubmitted(true);
    if (isRight) setScore((s) => s + 1);

    if (context) {
      recordAnswer(context.grade, context.chapterId, q.difficulty, isRight);
      if (context.revisionMode && context.revisionIds?.[index]) {
        recordMistakeOutcome(context.revisionIds[index], isRight);
      } else if (!isRight) {
        addMistake({
          grade: context.grade,
          chapterId: context.chapterId,
          chapterTitle: context.chapterTitle,
          question: q,
          studentAnswer: value,
        });
      }
    }
  }

  function next() {
    if (index + 1 >= total) {
      setDone(true);
      onComplete(score, total);
      return;
    }
    setIndex((i) => i + 1);
    setSubmitted(false);
    setInput("");
    setCorrect(false);
    setExplanation(null);
    explainMut.reset();
    twinsMut.reset();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || !q) return;
      if (submitted && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        next();
        return;
      }
      if (submitted) return;
      const opts = q.options ?? [];
      const k = e.key.toUpperCase();
      let idx = -1;
      if (k >= "1" && k <= "4") idx = parseInt(k, 10) - 1;
      else if (k >= "A" && k <= "D") idx = k.charCodeAt(0) - 65;
      if (idx >= 0 && idx < opts.length) {
        e.preventDefault();
        check(opts[idx]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, done, index]);

  if (total === 0) {
    return (
      <div className="bg-card shadow-card mx-auto max-w-2xl rounded-3xl p-8 text-center">
        <p className="font-bold">No MCQs available.</p>
        <p className="text-muted-foreground mt-1 text-sm">Try regenerating this set.</p>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((score / total) * 100);
    return (
      <div className="bg-card shadow-card mx-auto max-w-2xl rounded-3xl p-8 text-center">
        <Sparkles className="text-primary mx-auto h-12 w-12" />
        <h2 className="mt-3 text-3xl font-extrabold">Quest Complete!</h2>
        <p className="text-muted-foreground mt-2">{title}</p>
        <p className="my-6 text-6xl font-extrabold">
          {score}<span className="text-muted-foreground text-3xl">/{total}</span>
        </p>
        <p className="text-lg font-semibold">{pct}% correct</p>
        <p className="text-muted-foreground mt-2">
          {pct >= 85 ? "Outstanding! ⭐⭐⭐" : pct >= 60 ? "Great job! ⭐⭐" : pct >= 35 ? "Nice start! ⭐" : "Keep practising!"}
        </p>
      </div>
    );
  }

  const progressPct = ((index + (submitted ? 1 : 0)) / total) * 100;
  const options = q.options ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>
        <p className="text-muted-foreground text-sm font-semibold">
          {index + 1} / {total}
        </p>
      </div>
      <div className="bg-secondary mb-6 h-2 overflow-hidden rounded-full">
        <div className="bg-gradient-hero h-full transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="bg-card shadow-card rounded-3xl p-6">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
          MCQ · {q.difficulty} · tap an option or press {LETTERS.join("/")}
        </p>
        <p className="mt-1 text-lg font-semibold whitespace-pre-wrap">{q.prompt}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {options.map((opt, i) => {
            const isPicked = submitted && normalize(opt) === normalize(input);
            const isAnswer = submitted && normalize(opt) === normalize(q.answer);
            const dim = submitted && !isPicked && !isAnswer;
            return (
              <button
                key={opt + i}
                onClick={() => check(opt)}
                disabled={submitted}
                className={`group flex min-h-[64px] items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left font-semibold transition ${
                  isAnswer
                    ? "border-success bg-success/10 text-success"
                    : isPicked
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : dim
                        ? "border-border bg-secondary/40 opacity-60"
                        : "border-border hover:border-primary hover:bg-primary/5"
                }`}
              >
                <span
                  className={`flex h-8 w-8 flex-none items-center justify-center rounded-xl text-sm font-extrabold transition ${
                    isAnswer
                      ? "bg-success text-success-foreground"
                      : isPicked
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                  }`}
                >
                  {LETTERS[i]}
                </span>
                <span className="flex-1 self-center text-base leading-snug">{opt}</span>
                {isAnswer && <Check className="mt-1 h-5 w-5 flex-none" />}
                {isPicked && !isAnswer && <X className="mt-1 h-5 w-5 flex-none" />}
              </button>
            );
          })}
        </div>

        {submitted && (
          <div
            className={`mt-5 rounded-2xl p-4 ${
              correct ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            }`}
          >
            <p className="font-extrabold">
              {correct ? "✓ Correct!" : `✗ Answer: ${q.answer}`}
            </p>
            <p className="text-foreground mt-1 text-sm">{q.explanation}</p>
          </div>
        )}

        {submitted && !correct && context && (
          <div className="bg-primary/5 border-primary/30 mt-3 rounded-2xl border-2 p-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="text-primary h-4 w-4" />
              <p className="text-primary text-[10px] font-bold tracking-[0.18em] uppercase">
                Why this is wrong · HBK Mathy
              </p>
            </div>
            {explainMut.isPending && !explanation && (
              <div className="text-muted-foreground mt-2 flex items-center gap-2 text-sm font-semibold">
                <div className="border-primary h-3 w-3 animate-spin rounded-full border-2 border-t-transparent" />
                HBK Mathy is explaining…
              </div>
            )}
            {explanation && <p className="mt-2 text-sm whitespace-pre-wrap">{explanation}</p>}
            {explanation && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setExplanation(null);
                    explainMut.reset();
                    explainMut.mutate({ q, studentAnswer: input });
                  }}
                  className="text-primary text-xs font-bold underline-offset-2 hover:underline"
                >
                  Explain differently
                </button>
                <button
                  onClick={() => twinsMut.mutate(q)}
                  disabled={twinsMut.isPending}
                  className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  {twinsMut.isPending
                    ? "Adding…"
                    : twinsMut.isSuccess
                      ? "3 twins added"
                      : "More like this (+3)"}
                </button>
              </div>
            )}
          </div>
        )}

        {submitted && (
          <button
            onClick={next}
            className="bg-foreground text-background mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold transition hover:opacity-90"
          >
            {index + 1 >= total ? "See results" : "Next question"}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

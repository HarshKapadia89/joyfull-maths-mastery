import { useState } from "react";
import type { QuizQuestion } from "@/lib/quiz.functions";
import { Check, X, ArrowRight, Sparkles } from "lucide-react";

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function QuizRunner({
  questions,
  onComplete,
  title,
  subtitle,
}: {
  questions: QuizQuestion[];
  onComplete: (score: number, total: number) => void;
  title: string;
  subtitle?: string;
}) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [input, setInput] = useState("");
  const [correct, setCorrect] = useState(false);
  const [done, setDone] = useState(false);

  const total = questions.length;
  const q = questions[index];

  function check(value: string) {
    if (submitted) return;
    const isRight = normalize(value) === normalize(q.answer);
    setCorrect(isRight);
    setSubmitted(true);
    if (isRight) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= total) {
      setDone(true);
      onComplete(score + (submitted && correct ? 0 : 0), total);
      return;
    }
    setIndex((i) => i + 1);
    setSubmitted(false);
    setInput("");
    setCorrect(false);
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
          {q.type.replace("_", " ")} · {q.difficulty}
        </p>
        <p className="mt-1 text-lg font-semibold whitespace-pre-wrap">{q.prompt}</p>

        <div className="mt-5 space-y-2">
          {(q.type === "mcq" || q.type === "true_false") && q.options ? (
            q.options.map((opt) => {
              const isPicked = submitted && normalize(opt) === normalize(input);
              const isAnswer = submitted && normalize(opt) === normalize(q.answer);
              return (
                <button
                  key={opt}
                  onClick={() => {
                    setInput(opt);
                    check(opt);
                  }}
                  disabled={submitted}
                  className={`w-full rounded-xl border-2 px-4 py-3 text-left font-semibold transition ${
                    isAnswer
                      ? "border-success bg-success/10 text-success"
                      : isPicked
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-border hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  {opt}
                  {isAnswer && <Check className="ml-2 inline h-4 w-4" />}
                  {isPicked && !isAnswer && <X className="ml-2 inline h-4 w-4" />}
                </button>
              );
            })
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!submitted && input.trim()) check(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={submitted}
                placeholder="Type your answer…"
                className="border-border focus:border-primary focus:ring-primary/30 flex-1 rounded-xl border-2 px-4 py-3 font-semibold outline-none focus:ring-2"
                autoFocus
              />
              {!submitted && (
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-5 py-3 font-bold"
                >
                  Check
                </button>
              )}
            </form>
          )}
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

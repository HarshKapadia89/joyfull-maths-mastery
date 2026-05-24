import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Send, MessageCircle, ListChecks } from "lucide-react";
import { askTutor, solveStepByStep, type Solution } from "@/lib/quiz.functions";
import mascot from "@/assets/mathy-mascot.png";

export const Route = createFileRoute("/tutor")({
  head: () => ({
    meta: [
      { title: "Ask HBK Mathy · NCERT Maths AI Tutor | HBK Maths Quest" },
      { name: "description", content: "Ask any NCERT Maths question and get a friendly step-by-step explanation from HBK Mathy." },
    ],
  }),
  component: TutorPage,
});

type Msg = { role: "user" | "assistant"; content: string };
type Mode = "chat" | "solve";

function TutorPage() {
  const ask = useServerFn(askTutor);
  const solve = useServerFn(solveStepByStep);
  const [mode, setMode] = useState<Mode>("chat");
  const [grade, setGrade] = useState<number | undefined>(undefined);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm HBK Mathy. Ask me anything from NCERT Maths — I'll break it down step by step." },
  ]);
  const [solution, setSolution] = useState<Solution | null>(null);

  const chatMut = useMutation({
    mutationFn: async (q: string) => (await ask({ data: { question: q, grade } })).answer,
    onSuccess: (answer) => setMessages((m) => [...m, { role: "assistant", content: answer }]),
    onError: (err) =>
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${(err as Error).message}` }]),
  });

  const solveMut = useMutation({
    mutationFn: async (problem: string) => solve({ data: { problem, grade } }),
    onSuccess: (s) => setSolution(s),
  });

  function send(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    if (mode === "chat") {
      if (chatMut.isPending) return;
      setMessages((m) => [...m, { role: "user", content: q }]);
      setInput("");
      chatMut.mutate(q);
    } else {
      if (solveMut.isPending) return;
      setSolution(null);
      solveMut.mutate(q);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <div className="bg-gradient-learn shadow-glow mb-4 flex items-center gap-4 rounded-3xl p-6 text-white">
        <img src={mascot} alt="" width={64} height={64} className="h-16 w-16 drop-shadow-lg" />
        <div className="flex-1">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-90">Learning Mode</p>
          <h1 className="text-2xl font-extrabold">Ask HBK Mathy</h1>
        </div>
        <select
          value={grade ?? ""}
          onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : undefined)}
          className="rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold text-white outline-none"
        >
          <option value="" className="text-foreground">Any grade</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
            <option key={g} value={g} className="text-foreground">Grade {g}</option>
          ))}
        </select>
      </div>

      <div className="bg-card shadow-card mb-4 grid grid-cols-2 gap-1 rounded-2xl p-1">
        <button
          onClick={() => setMode("chat")}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            mode === "chat" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageCircle className="h-4 w-4" /> Chat
        </button>
        <button
          onClick={() => setMode("solve")}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            mode === "solve" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ListChecks className="h-4 w-4" /> Solve a problem
        </button>
      </div>

      {mode === "chat" ? (
        <div className="bg-card shadow-card mb-4 space-y-3 rounded-3xl p-5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-2xl px-4 py-3 whitespace-pre-wrap ${
                m.role === "user" ? "bg-primary text-primary-foreground ml-12" : "bg-secondary text-secondary-foreground mr-12"
              }`}
            >
              {m.content}
            </div>
          ))}
          {chatMut.isPending && (
            <div className="bg-secondary text-muted-foreground mr-12 rounded-2xl px-4 py-3 text-sm">
              HBK Mathy is thinking…
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card shadow-card mb-4 rounded-3xl p-5">
          {!solution && !solveMut.isPending && (
            <p className="text-muted-foreground text-sm">
              Paste a maths problem below — HBK Mathy will show every step.
            </p>
          )}
          {solveMut.isPending && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
              <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
              Solving…
            </div>
          )}
          {solveMut.isError && (
            <p className="text-destructive text-sm font-semibold">{(solveMut.error as Error).message}</p>
          )}
          {solution && (
            <div className="space-y-3">
              <ol className="space-y-2">
                {solution.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="bg-primary/10 text-primary flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold">
                      {i + 1}
                    </span>
                    <p className="pt-0.5 text-sm whitespace-pre-wrap">{s}</p>
                  </li>
                ))}
              </ol>
              <div className="bg-success/10 text-success rounded-2xl p-4">
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase">Final answer</p>
                <p className="text-xl font-extrabold">{solution.finalAnswer}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "chat" ? "e.g. Explain LCM with an example" : "e.g. Solve: 3x + 5 = 20"}
          className="border-border focus:border-primary flex-1 rounded-2xl border-2 bg-card px-4 py-3 font-semibold outline-none"
        />
        <button
          type="submit"
          disabled={(mode === "chat" ? chatMut.isPending : solveMut.isPending) || !input.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {mode === "chat" ? "Ask" : "Solve"}
        </button>
      </form>
    </div>
  );
}

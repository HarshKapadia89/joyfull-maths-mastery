import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { askTutor } from "@/lib/quiz.functions";
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

function TutorPage() {
  const ask = useServerFn(askTutor);
  const [grade, setGrade] = useState<number | undefined>(undefined);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm HBK Mathy. Ask me anything from NCERT Maths — I'll break it down step by step." },
  ]);

  const mutation = useMutation({
    mutationFn: async (question: string) => (await ask({ data: { question, grade } })).answer,
    onSuccess: (answer) => setMessages((m) => [...m, { role: "assistant", content: answer }]),
    onError: (err) =>
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${(err as Error).message}` }]),
  });

  function send(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || mutation.isPending) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    mutation.mutate(q);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <div className="bg-gradient-learn shadow-glow mb-6 flex items-center gap-4 rounded-3xl p-6 text-white">
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
        {mutation.isPending && (
          <div className="bg-secondary text-muted-foreground mr-12 rounded-2xl px-4 py-3 text-sm">
            HBK Mathy is thinking…
          </div>
        )}
      </div>

      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Explain LCM with an example"
          className="border-border focus:border-primary flex-1 rounded-2xl border-2 bg-card px-4 py-3 font-semibold outline-none"
        />
        <button
          type="submit"
          disabled={mutation.isPending || !input.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Ask
        </button>
      </form>
    </div>
  );
}

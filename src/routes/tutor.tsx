import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowLeft, Send, MessageCircle, ListChecks, Camera, X, Upload } from "lucide-react";
import { askTutor, solveStepByStep, solveFromImage, type Solution } from "@/lib/quiz.functions";
import mascot from "@/assets/mathy-mascot.png";

export const Route = createFileRoute("/tutor")({
  head: () => ({
    meta: [
      { title: "Ask HBK Mathy · NCERT Maths AI Tutor | HBK Maths Quest" },
      { name: "description", content: "Ask any NCERT Maths question — type it, or snap a photo. HBK Mathy explains step by step." },
    ],
  }),
  component: TutorPage,
});

type Msg = { role: "user" | "assistant"; content: string };
type Mode = "chat" | "solve" | "photo";

const MAX_IMG_BYTES = 6_000_000; // ~6MB after resize

async function fileToResizedDataUrl(file: File, maxDim = 1400): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function TutorPage() {
  const ask = useServerFn(askTutor);
  const solve = useServerFn(solveStepByStep);
  const solveImg = useServerFn(solveFromImage);
  const [mode, setMode] = useState<Mode>("chat");
  const [grade, setGrade] = useState<number | undefined>(undefined);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm HBK Mathy. Ask me anything from NCERT Maths — I'll break it down step by step." },
  ]);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [imgDataUrl, setImgDataUrl] = useState<string | null>(null);
  const [imgNote, setImgNote] = useState("");
  const [imgAnswer, setImgAnswer] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const photoMut = useMutation({
    mutationFn: async () => {
      if (!imgDataUrl) throw new Error("Please add a photo first.");
      return solveImg({ data: { imageDataUrl: imgDataUrl, grade, note: imgNote || undefined } });
    },
    onSuccess: (r) => setImgAnswer(r.answer),
    onError: (e) => setImgError((e as Error).message),
  });

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImgError(null);
    setImgAnswer(null);
    try {
      const url = await fileToResizedDataUrl(f);
      if (url.length > MAX_IMG_BYTES) {
        setImgError("That photo is too large even after resizing. Please try a smaller one.");
        return;
      }
      setImgDataUrl(url);
    } catch {
      setImgError("Couldn't read that file. Try another image.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function send(e: React.FormEvent | React.KeyboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    if (mode === "photo") {
      if (photoMut.isPending || !imgDataUrl) return;
      setImgAnswer(null);
      setImgError(null);
      photoMut.mutate();
      return;
    }
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

      <div className="bg-card shadow-card mb-4 grid grid-cols-3 gap-1 rounded-2xl p-1">
        <button
          onClick={() => setMode("chat")}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
            mode === "chat" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageCircle className="h-4 w-4" /> Chat
        </button>
        <button
          onClick={() => setMode("solve")}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
            mode === "solve" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ListChecks className="h-4 w-4" /> Solve
        </button>
        <button
          onClick={() => setMode("photo")}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
            mode === "photo" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="h-4 w-4" /> Photo
        </button>
      </div>

      {mode === "chat" && (
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
      )}

      {mode === "solve" && (
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

      {mode === "photo" && (
        <div className="bg-card shadow-card mb-4 rounded-3xl p-5">
          <p className="text-muted-foreground mb-3 text-sm">
            Stuck on a question in your textbook or notebook? Snap a clear photo and HBK Mathy will read it and solve it step-by-step.
          </p>

          {!imgDataUrl ? (
            <label className="border-border hover:border-primary hover:bg-primary/5 mb-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition">
              <Upload className="text-primary h-8 w-8" />
              <p className="font-bold">Tap to add a photo</p>
              <p className="text-muted-foreground text-xs">JPG or PNG · up to 10MB · resized automatically</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onPickFile}
              />
            </label>
          ) : (
            <div className="relative mb-3">
              <img
                src={imgDataUrl}
                alt="Your question"
                className="border-border max-h-80 w-full rounded-2xl border-2 object-contain"
              />
              <button
                onClick={() => {
                  setImgDataUrl(null);
                  setImgAnswer(null);
                  setImgError(null);
                }}
                className="bg-destructive text-destructive-foreground absolute top-2 right-2 rounded-full p-1.5 shadow-md"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <input
            value={imgNote}
            onChange={(e) => setImgNote(e.target.value)}
            placeholder="Optional note — e.g. 'Solve only part (b)'"
            className="border-border focus:border-primary mb-3 w-full rounded-xl border-2 bg-card px-3 py-2 text-sm outline-none"
          />

          {photoMut.isPending && (
            <div className="text-muted-foreground flex items-center gap-2 py-2 text-sm font-semibold">
              <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
              Reading your photo and solving…
            </div>
          )}
          {imgError && <p className="text-destructive text-sm font-semibold">{imgError}</p>}
          {imgAnswer && (
            <div className="bg-secondary/40 mt-2 rounded-2xl p-4">
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground mb-1">
                HBK Mathy says
              </p>
              <p className="text-sm whitespace-pre-wrap">{imgAnswer}</p>
            </div>
          )}
        </div>
      )}

      <form onSubmit={send} className="flex gap-2 items-end">
        {mode !== "photo" && (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(e);
              }
            }}
            placeholder={mode === "chat" ? "e.g. Explain LCM with an example" : "e.g. Solve: 3x + 5 = 20"}
            rows={3}
            className="border-border focus:border-primary flex-1 resize-none rounded-2xl border-2 bg-card px-4 py-4 font-semibold outline-none"
          />
        )}
        <button
          type="submit"
          disabled={
            mode === "chat"
              ? chatMut.isPending || !input.trim()
              : mode === "solve"
                ? solveMut.isPending || !input.trim()
                : photoMut.isPending || !imgDataUrl
          }
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-bold disabled:opacity-50"
          aria-label={mode === "chat" ? "Ask" : mode === "solve" ? "Solve" : "Solve photo"}
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}

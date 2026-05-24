import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, FileDown, Users } from "lucide-react";
import { useProgress, loadMistakes } from "@/hooks/useProgress";
import { downloadParentDigestPdf } from "@/lib/pdf/parentDigestPdf";

export const Route = createFileRoute("/parent")({
  head: () => ({ meta: [
    { title: "Parent Weekly Digest · HBK Maths Quest" },
    { name: "description", content: "Download a printable weekly progress report for parents." },
  ] }),
  component: ParentPage,
});

function ParentPage() {
  const { state } = useProgress();
  const [name, setName] = useState("");

  function handleDownload() {
    downloadParentDigestPdf({
      state,
      studentName: name.trim() || undefined,
      mistakesCount: loadMistakes().length,
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link to="/" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <div className="bg-gradient-hero shadow-glow mb-6 rounded-3xl p-6 text-white">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-90">For families</p>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Users className="h-7 w-7" /> Parent Digest</h1>
        <p className="mt-1 text-sm opacity-90">A one-page printable HBK report — stars, focus areas, weekly tips.</p>
      </div>
      <div className="bg-card shadow-card space-y-4 rounded-3xl p-6">
        <label className="block">
          <span className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">Student name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riya Patel"
            className="border-border bg-card mt-1 w-full rounded-xl border-2 px-4 py-3 font-semibold outline-none" />
        </label>
        <button onClick={handleDownload}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold">
          <FileDown className="h-4 w-4" /> Download weekly digest (PDF)
        </button>
        <p className="text-muted-foreground text-xs">All data lives on this device. The PDF is generated locally and watermarked with the school crest.</p>
      </div>
    </div>
  );
}

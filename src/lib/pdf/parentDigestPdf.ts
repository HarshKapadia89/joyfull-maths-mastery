import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ProgressState } from "@/hooks/useProgress";
import { GRADE_THEMES } from "@/data/grade-themes";
import { getChapters } from "@/data/ncert-maths";
import {
  drawCover,
  fileName,
  finalizePages,
  INDIGO,
  INK,
  LINE,
  makePackId,
  MUTED,
  SUCCESS,
  WARN,
} from "./brand";

export function downloadParentDigestPdf(opts: {
  state: ProgressState;
  studentName?: string;
  mistakesCount: number;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const packId = makePackId("HBK-PARENT");
  const cover = new Set<number>();
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  drawCover(doc, {
    kind: "Parent Weekly Digest",
    title: opts.studentName ?? "Student progress report",
    subtitle: `Snapshot for ${today}`,
    packId,
  });
  cover.add(1);

  doc.addPage();
  const w = doc.internal.pageSize.getWidth();

  // Headline KPIs
  const kpis: [string, string][] = [
    ["Total stars", String(opts.state.totalStars)],
    ["XP earned", String(opts.state.xp)],
    ["Day streak", String(opts.state.streak)],
    ["Mistake bank", String(opts.mistakesCount)],
  ];
  let x = 14;
  const tileW = (w - 28 - 9) / 4;
  kpis.forEach(([label, value]) => {
    doc.setFillColor(245, 244, 252);
    doc.roundedRect(x, 24, tileW, 26, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(INDIGO.r, INDIGO.g, INDIGO.b);
    doc.text(value, x + tileW / 2, 36, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(label.toUpperCase(), x + tileW / 2, 44, { align: "center" });
    x += tileW + 3;
  });

  // Build per-chapter rows for all grades the student has touched
  type Row = {
    grade: number;
    chapter: string;
    asked: number;
    correct: number;
    attempts: number;
    stars: number;
  };
  const rows: Row[] = [];
  for (const t of GRADE_THEMES) {
    const chapters = getChapters(t.grade);
    for (const c of chapters) {
      const p = opts.state.chapters[`${t.grade}-${c.id}`];
      if (!p?.attempts) continue;
      rows.push({
        grade: t.grade,
        chapter: c.title,
        asked: p.asked ?? 0,
        correct: p.correct ?? 0,
        attempts: p.attempts,
        stars: p.stars,
      });
    }
  }

  // Top wins (accuracy >= 80, asked >= 5)
  const wins = rows
    .filter((r) => r.asked >= 5 && r.correct / r.asked >= 0.8)
    .sort((a, b) => b.correct / b.asked - a.correct / a.asked)
    .slice(0, 5);
  // Focus areas
  const focus = rows
    .filter((r) => r.asked >= 5 && r.correct / r.asked < 0.7)
    .sort((a, b) => a.correct / a.asked - b.correct / b.asked)
    .slice(0, 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(SUCCESS.r, SUCCESS.g, SUCCESS.b);
  doc.text("Top wins this week", 14, 62);
  if (wins.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text("Keep practising — wins will appear here once a chapter reaches 80% accuracy.", 14, 68);
  } else {
    autoTable(doc, {
      startY: 64,
      head: [["Grade", "Chapter", "Accuracy", "Attempts"]],
      body: wins.map((r) => [
        `G${r.grade}`,
        r.chapter,
        `${Math.round((r.correct / r.asked) * 100)}%`,
        String(r.attempts),
      ]),
      margin: { left: 14, right: 14, top: 22, bottom: 18 },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, textColor: [INK.r, INK.g, INK.b] },
      headStyles: { fillColor: [SUCCESS.r, SUCCESS.g, SUCCESS.b], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [240, 250, 246] },
    });
  }

  // Find a safe Y to continue
  let nextY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80;
  nextY += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(WARN.r, WARN.g, WARN.b);
  doc.text("Suggested focus areas", 14, nextY);

  if (focus.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text("No weak chapters identified yet — keep playing more quizzes!", 14, nextY + 6);
  } else {
    autoTable(doc, {
      startY: nextY + 4,
      head: [["Grade", "Chapter", "Accuracy", "Action"]],
      body: focus.map((r) => [
        `G${r.grade}`,
        r.chapter,
        `${Math.round((r.correct / r.asked) * 100)}%`,
        "Revise + retake a 25-Q quiz",
      ]),
      margin: { left: 14, right: 14, top: 22, bottom: 18 },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, textColor: [INK.r, INK.g, INK.b] },
      headStyles: { fillColor: [WARN.r, WARN.g, WARN.b], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [253, 247, 238] },
      columnStyles: { 3: { textColor: [MUTED.r, MUTED.g, MUTED.b], fontStyle: "italic" } },
    });
  }

  // Parent guidance block
  let footY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? nextY + 12;
  footY += 12;
  if (footY > 250) {
    doc.addPage();
    footY = 24;
  }
  doc.setDrawColor(LINE.r, LINE.g, LINE.b);
  doc.roundedRect(14, footY, w - 28, 36, 3, 3, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(INDIGO.r, INDIGO.g, INDIGO.b);
  doc.text("How parents can help this week", 18, footY + 7);
  const tips = [
    "• Spend 10 minutes a day revising the focus areas above.",
    "• Encourage your child to open Concept Cards before each quiz.",
    "• Celebrate the streak — consistency beats long study sessions.",
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(INK.r, INK.g, INK.b);
  tips.forEach((t, i) => doc.text(t, 18, footY + 14 + i * 6));

  finalizePages(doc, "Parent Weekly Digest", packId, cover);
  doc.save(fileName("all", opts.studentName ?? "Student", "Parent-Digest"));
}

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { WorksheetItem } from "@/lib/quiz.functions";
import {
  drawCover,
  drawSectionDivider,
  fileName,
  finalizePages,
  INDIGO,
  INK,
  LINE,
  makePackId,
  MUTED,
} from "./brand";

export function downloadWorksheetPdf(opts: {
  grade: number;
  chapterTitle: string;
  items: WorksheetItem[];
  includeAnswers?: boolean;
  studentName?: string;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const packId = makePackId();
  const cover = new Set<number>();
  const titleText =
    opts.chapterTitles.length === 1
      ? opts.chapterTitles[1]
      : opts.chapterTitles.length <= 3
        ? opts.chapterTitles.join(" + ")
        : `${opts.chapterTitles[0]} + ${opts.chapterTitles.length - 1} more`;

  drawCover(doc, {
    kind: `Worksheet · Grade ${opts.grade}`,
    title: titleText,
    subtitle: opts.includeAnswers ? "Teacher copy" : "Student copy",
    packId,
  });
  cover.add(1);

  // Name / date block
  doc.addPage();
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(`Name: ${opts.studentName ?? "_____________________________"}`, 14, 26);
  doc.text(`Date: _________________     Class / Section: ___________`, 14, 34);
  const total = opts.items.reduce((s, it) => s + it.marks, 0);
  doc.setTextColor(INDIGO.r, INDIGO.g, INDIGO.b);
  doc.text(`Total marks: ${total}`, w - 14, 26, { align: "right" });
  doc.setDrawColor(LINE.r, LINE.g, LINE.b);
  doc.line(14, 40, w - 14, 40);

  // Questions
  let y = 48;
  doc.setFontSize(10);
  doc.setTextColor(INK.r, INK.g, INK.b);
  const MARKS_RESERVE = 26; // mm reserved on the right for the [X marks] badge
  opts.items.forEach((it, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${it.question}`, w - 28 - MARKS_RESERVE);
    const needed = lines.length * 5 + 22;
    if (y + needed > 280) {
      doc.addPage();
      y = 24;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(INDIGO.r, INDIGO.g, INDIGO.b);
    doc.text(`[${it.marks} mark${it.marks > 1 ? "s" : ""}]`, w - 14, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 4;
    // 3 ruled lines for the answer
    doc.setDrawColor(LINE.r, LINE.g, LINE.b);
    for (let k = 0; k < 3; k++) {
      doc.line(14, y + k * 6, w - 14, y + k * 6);
    }
    y += 22;
  });

  if (opts.includeAnswers) {
    doc.addPage();
    drawSectionDivider(doc, "AK", "Answer Key", "Model solutions — for teacher use.");
    cover.add(doc.getNumberOfPages());
    doc.addPage();
    autoTable(doc, {
      startY: 24,
      head: [["#", "Marks", "Model solution"]],
      body: opts.items.map((it, i) => [String(i + 1), String(it.marks), it.solution]),
      margin: { left: 14, right: 14, top: 22, bottom: 18 },
      styles: { font: "helvetica", fontSize: 10, cellPadding: 3, textColor: [INK.r, INK.g, INK.b] },
      headStyles: { fillColor: [INDIGO.r, INDIGO.g, INDIGO.b], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 10, fontStyle: "bold", textColor: [INDIGO.r, INDIGO.g, INDIGO.b] },
        1: { cellWidth: 16, textColor: [MUTED.r, MUTED.g, MUTED.b] },
      },
      alternateRowStyles: { fillColor: [248, 247, 253] },
    });
  }

  finalizePages(doc, `Grade ${opts.grade} · ${titleText}`, packId, cover);
  doc.save(fileName(opts.grade, titleText, opts.includeAnswers ? "Worksheet-Teacher" : "Worksheet"));
}

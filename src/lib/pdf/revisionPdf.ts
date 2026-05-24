import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ConceptCard, Formula } from "@/lib/quiz.functions";

const SCHOOL = "The H. B. Kapadia New High School";
const SUBLINE = "HBK Maths Quest · Revision Pack";

// Brand colors (RGB)
const BRAND = { r: 79, g: 70, b: 229 }; // indigo
const ACCENT = { r: 234, g: 88, b: 12 }; // orange
const INK = { r: 30, g: 30, b: 40 };
const MUTED = { r: 110, g: 110, b: 120 };

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function drawHeader(doc: jsPDF, chapterTitle: string, grade: number) {
  const w = doc.internal.pageSize.getWidth();
  // accent bar
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, w, 18, "F");
  // HBK crest
  doc.setFillColor(255, 255, 255);
  doc.circle(14, 9, 6, "F");
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("HBK", 14, 10.5, { align: "center" });
  // school name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(SCHOOL, 24, 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${SUBLINE} · Grade ${grade} · ${chapterTitle}`, 24, 13);
}

function drawFooter(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(220, 220, 225);
  doc.setLineWidth(0.2);
  doc.line(12, h - 12, w - 12, h - 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(SCHOOL + " · For internal student use", 12, h - 7);
  const page = doc.getNumberOfPages();
  doc.text(`Page ${page}`, w - 12, h - 7, { align: "right" });
}

function frameEachPage(doc: jsPDF, chapterTitle: string, grade: number) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    if (i > 1) drawHeader(doc, chapterTitle, grade);
    drawFooter(doc);
  }
}

function drawCover(doc: jsPDF, opts: { grade: number; chapterTitle: string; kind: string }) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  // full brand background top
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, w, h * 0.45, "F");
  // crest
  doc.setFillColor(255, 255, 255);
  doc.circle(w / 2, 38, 14, "F");
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("HBK", w / 2, 42, { align: "center" });
  // school name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(SCHOOL, w / 2, 70, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("HBK Maths Quest", w / 2, 80, { align: "center" });

  // body
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text(opts.kind, w / 2, h * 0.45 + 25, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(`Grade ${opts.grade}`, w / 2, h * 0.45 + 38, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK.r, INK.g, INK.b);
  const titleLines = doc.splitTextToSize(opts.chapterTitle, w - 40);
  doc.text(titleLines, w / 2, h * 0.45 + 52, { align: "center" });

  // accent
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(w / 2 - 20, h * 0.45 + 70, 40, 2, "F");

  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text("Learn smart. Revise smarter.", w / 2, h * 0.45 + 82, { align: "center" });

  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(today, w / 2, h - 30, { align: "center" });
}

function renderConceptCards(doc: jsPDF, cards: ConceptCard[], startY: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 12;
  const gap = 6;
  const colW = (w - margin * 2 - gap) / 2;
  let x = margin;
  let y = startY;
  const cardH = 70;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text("Concept Cards", margin, y);
  y += 6;
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + 30, y);
  y += 6;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (y + cardH > h - 16) {
      doc.addPage();
      y = 26;
      x = margin;
    }
    // card frame
    doc.setDrawColor(220, 220, 230);
    doc.setFillColor(250, 250, 253);
    doc.roundedRect(x, y, colW, cardH, 3, 3, "FD");
    // title bar
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.roundedRect(x, y, colW, 8, 3, 3, "F");
    doc.rect(x, y + 4, colW, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const titleLines = doc.splitTextToSize(c.title, colW - 6);
    doc.text(titleLines[0] ?? c.title, x + 3, y + 5.5);

    // body
    let by = y + 13;
    const bw = colW - 6;
    doc.setTextColor(INK.r, INK.g, INK.b);
    const writeRow = (label: string, value: string, color = INK) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(color.r, color.g, color.b);
      doc.text(label, x + 3, by);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(INK.r, INK.g, INK.b);
      const lines = doc.splitTextToSize(value, bw);
      doc.text(lines.slice(0, 2), x + 3, by + 3.5);
      by += 3.5 + Math.min(lines.length, 2) * 3.2 + 1.5;
    };
    writeRow("Key idea", c.keyIdea, BRAND);
    writeRow("Example", c.example, INK);
    writeRow("Watch out", c.pitfall, ACCENT);
    if (c.examTip) writeRow("Exam tip", c.examTip, { r: 16, g: 122, b: 87 });

    if (i % 2 === 0) {
      x += colW + gap;
    } else {
      x = margin;
      y += cardH + gap;
    }
  }
}

function renderFormulaSheet(doc: jsPDF, formulas: Formula[], startY: number) {
  const margin = 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text("Formula Sheet", margin, startY);
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(0.8);
  doc.line(margin, startY + 2, margin + 30, startY + 2);

  autoTable(doc, {
    startY: startY + 8,
    head: [["Name", "Formula", "When to use"]],
    body: formulas.map((f) => [f.name, f.formula, f.whenToUse]),
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 3,
      textColor: [INK.r, INK.g, INK.b],
      lineColor: [220, 220, 230],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [BRAND.r, BRAND.g, BRAND.b],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45 },
      1: { font: "courier", cellWidth: 60 },
      2: { textColor: [MUTED.r, MUTED.g, MUTED.b] },
    },
  });
}

function fileName(grade: number, chapterTitle: string, suffix: string) {
  return `HBK-Maths_Grade-${grade}_${slug(chapterTitle)}_${suffix}.pdf`;
}

export function downloadConceptCardsPdf(opts: {
  grade: number;
  chapterTitle: string;
  cards: ConceptCard[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawCover(doc, { ...opts, kind: "Concept Cards" });
  doc.addPage();
  renderConceptCards(doc, opts.cards, 26);
  frameEachPage(doc, opts.chapterTitle, opts.grade);
  doc.save(fileName(opts.grade, opts.chapterTitle, "Concept-Cards"));
}

export function downloadFormulaSheetPdf(opts: {
  grade: number;
  chapterTitle: string;
  formulas: Formula[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawCover(doc, { ...opts, kind: "Formula Sheet" });
  doc.addPage();
  renderFormulaSheet(doc, opts.formulas, 26);
  frameEachPage(doc, opts.chapterTitle, opts.grade);
  doc.save(fileName(opts.grade, opts.chapterTitle, "Formula-Sheet"));
}

export function downloadRevisionPackPdf(opts: {
  grade: number;
  chapterTitle: string;
  cards: ConceptCard[];
  formulas: Formula[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawCover(doc, { ...opts, kind: "Revision Pack" });
  doc.addPage();
  renderConceptCards(doc, opts.cards, 26);
  doc.addPage();
  renderFormulaSheet(doc, opts.formulas, 26);
  frameEachPage(doc, opts.chapterTitle, opts.grade);
  doc.save(fileName(opts.grade, opts.chapterTitle, "Revision-Pack"));
}

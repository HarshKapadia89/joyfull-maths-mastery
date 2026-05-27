import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  ConceptCard,
  Formula,
  PathwayTopic,
  TopicLesson,
  SolvedExample,
  ExamQuestion,
} from "@/lib/quiz.functions";


const SCHOOL = "The H. B. Kapadia New High School";
const TAGLINE = "HBK Maths Quest · Learn smart. Revise smarter.";
const WATERMARK = "THE H. B. KAPADIA NEW HIGH SCHOOL";

// Brand palette
const INDIGO = { r: 67, g: 56, b: 202 };
const VIOLET = { r: 124, g: 58, b: 237 };
const GOLD = { r: 202, g: 162, b: 73 };
const INK = { r: 24, g: 24, b: 35 };
const MUTED = { r: 120, g: 120, b: 132 };
const LINE = { r: 224, g: 224, b: 232 };

// Rotating rail colors per concept card
const RAIL_COLORS = [
  { r: 67, g: 56, b: 202 }, // indigo
  { r: 16, g: 122, b: 87 }, // emerald
  { r: 217, g: 119, b: 6 }, // amber
  { r: 225, g: 29, b: 72 }, // rose
  { r: 14, g: 116, b: 144 }, // cyan
  { r: 124, g: 58, b: 237 }, // violet
];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function makePackId() {
  const y = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HBK-${y}-${rand}`;
}

/**
 * Diagonal repeating watermark across the whole page.
 * Rendered first so content sits on top and stays legible.
 */
function drawWatermark(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  const GState = (doc as unknown as { GState?: new (o: { opacity: number }) => unknown }).GState;
  doc.saveGraphicsState();
  if (GState) {
    (doc as unknown as { setGState: (s: unknown) => void }).setGState(new GState({ opacity: 0.07 }));
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(INDIGO.r, INDIGO.g, INDIGO.b);

  const stepX = 95;
  const stepY = 38;
  for (let y = -20; y < h + stepY; y += stepY) {
    for (let x = -40, i = 0; x < w + stepX; x += stepX, i++) {
      const ox = (Math.floor((y + 20) / stepY) % 2) * (stepX / 2);
      doc.text(WATERMARK, x + ox, y, { angle: 30 });
    }
  }
  doc.restoreGraphicsState();
}

function drawHeader(doc: jsPDF, chapterTitle: string, grade: number) {
  const w = doc.internal.pageSize.getWidth();
  // top hairline
  doc.setDrawColor(LINE.r, LINE.g, LINE.b);
  doc.setLineWidth(0.2);
  doc.line(12, 14, w - 12, 14);

  // tiny crest
  doc.setFillColor(INDIGO.r, INDIGO.g, INDIGO.b);
  doc.circle(15, 9, 3.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("HBK", 15, 10.2, { align: "center" });

  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(SCHOOL, 20, 8.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text("HBK Maths Quest · Revision Pack", 20, 11.6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(INK.r, INK.g, INK.b);
  const right = `Grade ${grade} · ${chapterTitle}`;
  doc.text(right, w - 12, 10, { align: "right" });
}

function drawFooter(doc: jsPDF, packId: string, pageNum: number, totalPages: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(LINE.r, LINE.g, LINE.b);
  doc.setLineWidth(0.2);
  doc.line(12, h - 12, w - 12, h - 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(`${SCHOOL} · For internal student use only`, 12, h - 7);
  doc.text(packId, w / 2, h - 7, { align: "center" });
  doc.text(`Page ${pageNum} / ${totalPages}`, w - 12, h - 7, { align: "right" });
}

/**
 * Walk every page once and apply: watermark (bottom), header, footer.
 * Cover page skips header but keeps watermark + footer.
 */
function finalizePages(
  doc: jsPDF,
  chapterTitle: string,
  grade: number,
  packId: string,
  coverPages: Set<number>,
) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawWatermark(doc);
    if (!coverPages.has(i)) drawHeader(doc, chapterTitle, grade);
    drawFooter(doc, packId, i, total);
  }
}

/** Cover page - premium look, no header */
function drawCover(doc: jsPDF, opts: { grade: number; chapterTitle: string; kind: string; packId: string }) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // simulated indigo→violet gradient via stacked rects
  const bandH = h * 0.55;
  const steps = 60;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(INDIGO.r + (VIOLET.r - INDIGO.r) * t);
    const g = Math.round(INDIGO.g + (VIOLET.g - INDIGO.g) * t);
    const b = Math.round(INDIGO.b + (VIOLET.b - INDIGO.b) * t);
    doc.setFillColor(r, g, b);
    doc.rect(0, (i * bandH) / steps, w, bandH / steps + 0.3, "F");
  }

  // double-ring crest
  const cx = w / 2;
  const cy = 50;
  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(0.8);
  doc.circle(cx, cy, 20, "S");
  doc.setLineWidth(0.3);
  doc.circle(cx, cy, 17, "S");
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, 14, "F");
  doc.setTextColor(INDIGO.r, INDIGO.g, INDIGO.b);
  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.text("HBK", cx, cy + 3, { align: "center" });

  // School name
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(SCHOOL, cx, 88, { align: "center" });

  // gold accent bar
  doc.setFillColor(GOLD.r, GOLD.g, GOLD.b);
  doc.rect(cx - 18, 94, 36, 1.2, "F");

  // kicker
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`REVISION PACK   ·   GRADE ${opts.grade}`, cx, 103, { align: "center" });

  // Body section
  const bodyY = bandH + 24;
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("CHAPTER", cx, bodyY, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(INK.r, INK.g, INK.b);
  const titleLines = doc.splitTextToSize(opts.chapterTitle, w - 40);
  doc.text(titleLines, cx, bodyY + 12, { align: "center" });

  // Kind label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INDIGO.r, INDIGO.g, INDIGO.b);
  doc.text(opts.kind.toUpperCase(), cx, bodyY + 12 + titleLines.length * 10 + 8, {
    align: "center",
  });

  // tagline
  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(TAGLINE, cx, h - 32, { align: "center" });

  // pack id + date bottom right
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(`${opts.packId}   ·   ${today}`, w - 14, h - 22, { align: "right" });
}

/** Section divider page with oversized numeral */
function drawSectionDivider(doc: jsPDF, num: string, title: string, sub: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setFillColor(245, 244, 252);
  doc.rect(0, 0, w, h, "F");

  // gold accent
  doc.setFillColor(GOLD.r, GOLD.g, GOLD.b);
  doc.rect(20, h / 2 - 30, 1.5, 60, "F");

  doc.setFont("times", "bold");
  doc.setFontSize(140);
  doc.setTextColor(INDIGO.r, INDIGO.g, INDIGO.b);
  doc.text(num, 28, h / 2 + 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text("SECTION", 28, h / 2 - 32);

  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(title, w - 20, h / 2 - 4, { align: "right" });

  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  const subLines = doc.splitTextToSize(sub, w / 2);
  doc.text(subLines, w - 20, h / 2 + 8, { align: "right" });
}

/** Estimate card height for given content widths */
function measureCard(doc: jsPDF, c: ConceptCard, bodyW: number): number {
  doc.setFontSize(9);
  const rows: Array<[string, string]> = [
    ["KEY IDEA", c.keyIdea],
    ["EXAMPLE", c.example],
    ["WATCH OUT", c.pitfall],
  ];
  if (c.examTip) rows.push(["EXAM TIP", c.examTip]);
  let h = 10; // title area
  for (const [, v] of rows) {
    const lines = doc.splitTextToSize(v, bodyW);
    h += 4 + lines.length * 3.6 + 2.5;
  }
  return h + 6;
}

function renderConceptCards(doc: jsPDF, cards: ConceptCard[], chapterTitle: string, grade: number, packId: string) {
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const gap = 6;
  const colW = (w - margin * 2 - gap) / 2;
  const railW = 4;
  const padX = 5;
  const bodyW = colW - railW - padX * 2;
  const topLimit = 22;
  const bottomLimit = pageH - 18;

  let x = margin;
  let y = topLimit;
  let rowMaxH = 0;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const cardH = measureCard(doc, c, bodyW);
    const isLeft = i % 2 === 0;

    if (isLeft) {
      // starting a new row → check fit using estimated row height (this card + next if exists)
      const nextH = i + 1 < cards.length ? measureCard(doc, cards[i + 1], bodyW) : 0;
      const rowH = Math.max(cardH, nextH);
      if (y + rowH > bottomLimit) {
        doc.addPage();
        y = topLimit;
        rowMaxH = 0;
      }
      x = margin;
    } else {
      x = margin + colW + gap;
    }

    const rail = RAIL_COLORS[i % RAIL_COLORS.length];

    // shadow
    doc.setFillColor(0, 0, 0);
    const GState = (doc as unknown as { GState?: new (o: { opacity: number }) => unknown }).GState;
    doc.saveGraphicsState();
    if (GState) {
      (doc as unknown as { setGState: (s: unknown) => void }).setGState(new GState({ opacity: 0.06 }));
    }
    doc.roundedRect(x + 0.8, y + 1.2, colW, cardH, 3, 3, "F");
    doc.restoreGraphicsState();

    // card body
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(LINE.r, LINE.g, LINE.b);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, colW, cardH, 3, 3, "FD");

    // colored left rail
    doc.setFillColor(rail.r, rail.g, rail.b);
    doc.rect(x, y, railW, cardH, "F");

    // number chip
    doc.setFillColor(rail.r, rail.g, rail.b);
    doc.circle(x + railW + 6, y + 7, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(String(i + 1), x + railW + 6, y + 8, { align: "center" });

    // title
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    const titleX = x + railW + 12;
    const titleLines = doc.splitTextToSize(c.title, colW - (railW + 12) - padX);
    doc.text(titleLines[0] ?? c.title, titleX, y + 8.5);

    // hairline under title
    doc.setDrawColor(LINE.r, LINE.g, LINE.b);
    doc.line(x + railW + padX, y + 11.5, x + colW - padX, y + 11.5);

    // body rows
    let by = y + 15;
    const labelColors: Record<string, { r: number; g: number; b: number }> = {
      "KEY IDEA": rail,
      EXAMPLE: INK,
      "WATCH OUT": { r: 217, g: 119, b: 6 },
      "EXAM TIP": { r: 16, g: 122, b: 87 },
    };
    const rows: Array<[string, string]> = [
      ["KEY IDEA", c.keyIdea],
      ["EXAMPLE", c.example],
      ["WATCH OUT", c.pitfall],
    ];
    if (c.examTip) rows.push(["EXAM TIP", c.examTip]);

    for (const [label, value] of rows) {
      const lc = labelColors[label];
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(lc.r, lc.g, lc.b);
      doc.text(label, x + railW + padX, by);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(INK.r, INK.g, INK.b);
      const lines = doc.splitTextToSize(value, bodyW);
      doc.text(lines, x + railW + padX, by + 3.5);
      by += 4 + lines.length * 3.6 + 2.5;
    }

    rowMaxH = Math.max(rowMaxH, cardH);
    if (!isLeft) {
      y += rowMaxH + gap;
      rowMaxH = 0;
    } else if (i === cards.length - 1) {
      // last card was solo on left
      y += cardH + gap;
    }
  }
  void chapterTitle;
  void grade;
  void packId;
}

function renderFormulaSheet(doc: jsPDF, formulas: Formula[]) {
  const margin = 14;
  autoTable(doc, {
    startY: 24,
    head: [["Name", "Formula", "When to use"]],
    body: formulas.map((f) => [f.name, f.formula, f.whenToUse]),
    margin: { left: margin, right: margin, top: 22, bottom: 18 },
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 4,
      textColor: [INK.r, INK.g, INK.b],
      lineColor: [LINE.r, LINE.g, LINE.b],
      lineWidth: 0.15,
      valign: "middle",
    },
    headStyles: {
      fillColor: [INDIGO.r, INDIGO.g, INDIGO.b],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 4,
    },
    alternateRowStyles: { fillColor: [248, 247, 253] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, textColor: [INDIGO.r, INDIGO.g, INDIGO.b] },
      1: {
        font: "courier",
        cellWidth: 62,
        fillColor: [240, 238, 252],
        textColor: [INK.r, INK.g, INK.b],
      },
      2: { textColor: [MUTED.r, MUTED.g, MUTED.b], fontStyle: "italic" },
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
  const packId = makePackId();
  const cover = new Set<number>();
  drawCover(doc, { ...opts, kind: "Concept Cards", packId });
  cover.add(1);
  doc.addPage();
  drawSectionDivider(doc, "01", "Concept Cards", "Bite-sized ideas, examples and exam tips for fast revision.");
  cover.add(doc.getNumberOfPages());
  doc.addPage();
  renderConceptCards(doc, opts.cards, opts.chapterTitle, opts.grade, packId);
  finalizePages(doc, opts.chapterTitle, opts.grade, packId, cover);
  doc.save(fileName(opts.grade, opts.chapterTitle, "Concept-Cards"));
}

export function downloadFormulaSheetPdf(opts: {
  grade: number;
  chapterTitle: string;
  formulas: Formula[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const packId = makePackId();
  const cover = new Set<number>();
  drawCover(doc, { ...opts, kind: "Formula Sheet", packId });
  cover.add(1);
  doc.addPage();
  drawSectionDivider(doc, "01", "Formula Sheet", "Every key formula, where it lives, and when to reach for it.");
  cover.add(doc.getNumberOfPages());
  doc.addPage();
  renderFormulaSheet(doc, opts.formulas);
  finalizePages(doc, opts.chapterTitle, opts.grade, packId, cover);
  doc.save(fileName(opts.grade, opts.chapterTitle, "Formula-Sheet"));
}

// ============================================================
// DEEP-LEARNING SECTIONS (Learning Pathway · Solved Examples · Exam Corner)
// ============================================================

const PAGE_TOP = 22;
const PAGE_BOTTOM = 18;
const PAGE_MARGIN_X = 14;

function pageHeight(doc: jsPDF) {
  return doc.internal.pageSize.getHeight();
}
function pageWidth(doc: jsPDF) {
  return doc.internal.pageSize.getWidth();
}
function contentWidth(doc: jsPDF) {
  return pageWidth(doc) - PAGE_MARGIN_X * 2;
}
/** Ensure `needed` mm fits on current page; otherwise add a new page and reset y. */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > pageHeight(doc) - PAGE_BOTTOM) {
    doc.addPage();
    return PAGE_TOP;
  }
  return y;
}

function drawSectionHeading(doc: jsPDF, y: number, label: string, sub?: string): number {
  y = ensureSpace(doc, y, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(INDIGO.r, INDIGO.g, INDIGO.b);
  doc.text(label.toUpperCase(), PAGE_MARGIN_X, y);
  if (sub) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(sub, PAGE_MARGIN_X + 40, y);
  }
  doc.setDrawColor(LINE.r, LINE.g, LINE.b);
  doc.setLineWidth(0.2);
  doc.line(PAGE_MARGIN_X, y + 1.5, pageWidth(doc) - PAGE_MARGIN_X, y + 1.5);
  return y + 6;
}

function drawLabel(doc: jsPDF, x: number, y: number, label: string, color = INDIGO) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(color.r, color.g, color.b);
  doc.text(label.toUpperCase(), x, y);
}

/** Render a wrapped paragraph with optional bold label prefix. Returns new y. */
function drawParagraph(
  doc: jsPDF,
  y: number,
  text: string,
  opts: { fontSize?: number; label?: string; indent?: number; color?: { r: number; g: number; b: number } } = {},
): number {
  const fontSize = opts.fontSize ?? 9;
  const indent = opts.indent ?? 0;
  const x = PAGE_MARGIN_X + indent;
  const w = contentWidth(doc) - indent;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor((opts.color ?? INK).r, (opts.color ?? INK).g, (opts.color ?? INK).b);

  let body = text;
  let firstLineX = x;
  let firstLineWidth = w;
  if (opts.label) {
    doc.setFont("helvetica", "bold");
    const labelText = `${opts.label} `;
    const labelWidth = doc.getTextWidth(labelText);
    y = ensureSpace(doc, y, fontSize * 0.45);
    doc.text(labelText, x, y + fontSize * 0.35);
    firstLineX = x + labelWidth;
    firstLineWidth = w - labelWidth;
    doc.setFont("helvetica", "normal");
  }

  // Wrap manually so the label-line gets a narrower width.
  const allLines = doc.splitTextToSize(body, w);
  // If we have a label, re-split first chunk for narrower width.
  if (opts.label && allLines.length > 0) {
    const firstChunk = doc.splitTextToSize(body, firstLineWidth);
    const lineH = fontSize * 0.45;
    y = ensureSpace(doc, y, lineH);
    doc.text(firstChunk[0], firstLineX, y + fontSize * 0.35);
    y += lineH;
    body = firstChunk.length > 1 ? firstChunk.slice(1).join(" ") : "";
    if (body) {
      const rest = doc.splitTextToSize(body, w);
      for (const line of rest) {
        y = ensureSpace(doc, y, lineH);
        doc.text(line, x, y + fontSize * 0.35);
        y += lineH;
      }
    }
    return y + 1;
  }

  const lineH = fontSize * 0.45;
  for (const line of allLines) {
    y = ensureSpace(doc, y, lineH);
    doc.text(line, x, y + fontSize * 0.35);
    y += lineH;
  }
  return y + 1;
}

function drawTintedBlock(
  doc: jsPDF,
  y: number,
  title: string,
  body: string,
  tint: { r: number; g: number; b: number } = { r: 245, g: 244, b: 252 },
  rail: { r: number; g: number; b: number } = INDIGO,
): number {
  const padding = 3;
  const fontSize = 8.5;
  const w = contentWidth(doc);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(body, w - padding * 2 - 3);
  const blockH = padding * 2 + 4 + lines.length * (fontSize * 0.45);
  y = ensureSpace(doc, y, blockH + 2);
  doc.setFillColor(tint.r, tint.g, tint.b);
  doc.roundedRect(PAGE_MARGIN_X, y, w, blockH, 2, 2, "F");
  doc.setFillColor(rail.r, rail.g, rail.b);
  doc.rect(PAGE_MARGIN_X, y, 1.2, blockH, "F");
  drawLabel(doc, PAGE_MARGIN_X + padding + 2, y + 4, title, rail);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  let by = y + 8;
  for (const line of lines) {
    doc.text(line, PAGE_MARGIN_X + padding + 2, by);
    by += fontSize * 0.45;
  }
  return y + blockH + 2;
}

function drawBoxedAnswer(doc: jsPDF, y: number, text: string): number {
  const fontSize = 9;
  const w = contentWidth(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(`Answer: ${text}`, w - 8);
  const h = 4 + lines.length * (fontSize * 0.45) + 2;
  y = ensureSpace(doc, y, h + 2);
  doc.setFillColor(240, 238, 252);
  doc.setDrawColor(INDIGO.r, INDIGO.g, INDIGO.b);
  doc.setLineWidth(0.3);
  doc.roundedRect(PAGE_MARGIN_X, y, w, h, 1.5, 1.5, "FD");
  doc.setTextColor(INDIGO.r, INDIGO.g, INDIGO.b);
  let by = y + 5;
  for (const line of lines) {
    doc.text(line, PAGE_MARGIN_X + 3, by);
    by += fontSize * 0.45;
  }
  return y + h + 2;
}

// ---------- Pathway at a glance (Quick pack) ----------
function renderPathwayAtAGlance(doc: jsPDF, topics: PathwayTopic[]) {
  let y = PAGE_TOP;
  y = drawSectionHeading(doc, y, "Pathway at a glance", "Your study checklist for this chapter");
  topics.forEach((t, i) => {
    const w = contentWidth(doc);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const titleLines = doc.splitTextToSize(t.title, w - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const oneLiner = doc.splitTextToSize(t.oneLiner, w - 14);
    const rowH = 4 + titleLines.length * 4.2 + oneLiner.length * 3.8 + 4;
    y = ensureSpace(doc, y, rowH);
    // numbered chip
    doc.setFillColor(INDIGO.r, INDIGO.g, INDIGO.b);
    doc.circle(PAGE_MARGIN_X + 4, y + 4, 3.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(String(i + 1), PAGE_MARGIN_X + 4, y + 5.4, { align: "center" });
    // title
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(titleLines, PAGE_MARGIN_X + 11, y + 4.8);
    // one-liner
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(oneLiner, PAGE_MARGIN_X + 11, y + 4.8 + titleLines.length * 4.2);
    // empty checkbox at right
    doc.setDrawColor(LINE.r, LINE.g, LINE.b);
    doc.setLineWidth(0.3);
    doc.rect(pageWidth(doc) - PAGE_MARGIN_X - 4, y + 1.5, 4, 4, "S");
    y += rowH;
  });
}

// ---------- Pathway roadmap overview (Full pack first page) ----------
function renderPathwayRoadmap(doc: jsPDF, topics: PathwayTopic[]) {
  let y = PAGE_TOP;
  y = drawSectionHeading(doc, y, "Learning roadmap", `${topics.length} topics · learn one at a time`);
  // numbered vertical list with gold rail
  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(0.6);
  const railX = PAGE_MARGIN_X + 4;
  const startY = y;
  topics.forEach((t, i) => {
    const w = contentWidth(doc) - 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(t.title, w);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    const oneLiner = doc.splitTextToSize(t.oneLiner, w);
    const rowH = 6 + titleLines.length * 4.6 + oneLiner.length * 4 + 6;
    y = ensureSpace(doc, y, rowH);
    // dot on rail
    doc.setFillColor(INDIGO.r, INDIGO.g, INDIGO.b);
    doc.circle(railX, y + 5, 2.6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(String(i + 1), railX, y + 6, { align: "center" });
    // title
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(titleLines, railX + 8, y + 6);
    // one-liner
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(oneLiner, railX + 8, y + 6 + titleLines.length * 4.6);
    y += rowH;
  });
  // rail line through current page (only if all on one page)
  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(0.5);
  doc.line(railX, startY + 8, railX, Math.min(y, pageHeight(doc) - PAGE_BOTTOM - 4));
}

// ---------- Single topic mini-lesson ----------
function renderTopicLesson(
  doc: jsPDF,
  index: number,
  topic: PathwayTopic,
  lesson: TopicLesson | null,
  grade: number,
) {
  // start each new lesson on a fresh page for readability
  doc.addPage();
  let y = PAGE_TOP;

  // topic header
  doc.setFillColor(INDIGO.r, INDIGO.g, INDIGO.b);
  doc.circle(PAGE_MARGIN_X + 4, y + 1, 3.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(String(index + 1), PAGE_MARGIN_X + 4, y + 2.2, { align: "center" });

  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(topic.title, contentWidth(doc) - 12);
  doc.text(titleLines, PAGE_MARGIN_X + 11, y + 3);
  y += 4 + titleLines.length * 6;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  const olLines = doc.splitTextToSize(topic.oneLiner, contentWidth(doc));
  doc.text(olLines, PAGE_MARGIN_X, y);
  y += olLines.length * 4 + 4;

  if (!lesson) {
    y = drawTintedBlock(
      doc,
      y,
      "Section unavailable",
      "We couldn't load this topic right now. Please retry from the Learning Pathway tab.",
      { r: 254, g: 242, b: 242 },
      { r: 220, g: 38, b: 38 },
    );
    return;
  }

  if (lesson.prerequisites) {
    y = drawTintedBlock(
      doc,
      y,
      "Prerequisites",
      lesson.prerequisites,
      { r: 245, g: 244, b: 252 },
      INDIGO,
    );
  }
  y = drawParagraph(doc, y, lesson.intuition, { label: "Intuition.", fontSize: 9.5 });
  y = drawParagraph(doc, y, lesson.definition, { label: "Definition.", fontSize: 9.5 });

  if (lesson.derivation) {
    const label = grade >= 8 ? "Derivation" : "Why it works";
    y = drawTintedBlock(doc, y, label, lesson.derivation, { r: 250, g: 247, b: 240 }, GOLD);
  }

  // worked examples
  y = ensureSpace(doc, y, 6);
  drawLabel(doc, PAGE_MARGIN_X, y + 2, "Worked examples");
  y += 5;
  lesson.workedExamples.forEach((ex, i) => {
    y = ensureSpace(doc, y, 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(`Example ${i + 1}.`, PAGE_MARGIN_X, y + 3);
    doc.setFont("helvetica", "normal");
    const problemLines = doc.splitTextToSize(ex.problem, contentWidth(doc) - 22);
    doc.text(problemLines, PAGE_MARGIN_X + 22, y + 3);
    y += Math.max(5, problemLines.length * 4.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    ex.steps.forEach((s, j) => {
      const lines = doc.splitTextToSize(`${j + 1}. ${s}`, contentWidth(doc) - 6);
      const h = lines.length * 4.2;
      y = ensureSpace(doc, y, h);
      doc.text(lines, PAGE_MARGIN_X + 6, y + 3);
      y += h;
    });
    y = drawBoxedAnswer(doc, y + 1, ex.finalAnswer);
  });

  // common mistakes
  y = ensureSpace(doc, y, 6);
  drawLabel(doc, PAGE_MARGIN_X, y + 2, "Common mistakes", { r: 217, g: 119, b: 6 });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(INK.r, INK.g, INK.b);
  lesson.commonMistakes.forEach((m) => {
    const lines = doc.splitTextToSize(`• ${m}`, contentWidth(doc) - 4);
    const h = lines.length * 4.2;
    y = ensureSpace(doc, y, h);
    doc.text(lines, PAGE_MARGIN_X + 4, y + 3);
    y += h;
  });
  y += 1;

  // practice check
  y = ensureSpace(doc, y, 6);
  drawLabel(doc, PAGE_MARGIN_X, y + 2, "Practice check", { r: 16, g: 122, b: 87 });
  y += 5;
  lesson.practiceCheck.forEach((p, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(INK.r, INK.g, INK.b);
    const qLines = doc.splitTextToSize(`Q${i + 1}. ${p.question}`, contentWidth(doc));
    const h1 = qLines.length * 4.2;
    y = ensureSpace(doc, y, h1 + 4);
    doc.text(qLines, PAGE_MARGIN_X, y + 3);
    y += h1;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(150, 150, 160);
    const aLines = doc.splitTextToSize(`Answer: ${p.answer}`, contentWidth(doc));
    doc.text(aLines, PAGE_MARGIN_X, y + 3);
    y += aLines.length * 3.8 + 1;
  });

  if (lesson.whatsNext) {
    y = drawTintedBlock(doc, y + 1, "What's next →", lesson.whatsNext, { r: 245, g: 244, b: 252 }, INDIGO);
  }
}

// ---------- Solved examples ----------
function renderSolvedExamples(doc: jsPDF, examples: SolvedExample[]) {
  let y = PAGE_TOP;
  y = drawSectionHeading(doc, y, "Solved examples", "Graded easy → medium → hard");
  const order: SolvedExample["difficulty"][] = ["easy", "medium", "hard"];
  for (const diff of order) {
    const subset = examples.filter((e) => e.difficulty === diff);
    if (!subset.length) continue;
    y = ensureSpace(doc, y, 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INDIGO.r, INDIGO.g, INDIGO.b);
    doc.text(diff.toUpperCase(), PAGE_MARGIN_X, y + 4);
    y += 8;

    subset.forEach((ex, i) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(INK.r, INK.g, INK.b);
      const tLines = doc.splitTextToSize(`Example ${i + 1}. ${ex.title}`, contentWidth(doc));
      y = ensureSpace(doc, y, tLines.length * 4.6 + 6);
      doc.text(tLines, PAGE_MARGIN_X, y + 3);
      y += tLines.length * 4.6 + 1;

      y = drawParagraph(doc, y, ex.given, { label: "Given.", fontSize: 9 });
      y = drawParagraph(doc, y, ex.toFind, { label: "To find.", fontSize: 9 });
      y = drawParagraph(doc, y, ex.method, {
        label: "Method.",
        fontSize: 8.5,
        color: MUTED,
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(INK.r, INK.g, INK.b);
      ex.steps.forEach((s, j) => {
        const lines = doc.splitTextToSize(`${j + 1}. ${s}`, contentWidth(doc) - 6);
        const h = lines.length * 4.2;
        y = ensureSpace(doc, y, h);
        doc.text(lines, PAGE_MARGIN_X + 6, y + 3);
        y += h;
      });
      y = drawBoxedAnswer(doc, y + 1, ex.finalAnswer);

      if (ex.alternateMethod) {
        y = drawParagraph(doc, y, ex.alternateMethod, {
          label: "Alternate method.",
          fontSize: 8.5,
          color: MUTED,
        });
      }
      y += 2;
    });
  }
}

// ---------- Exam highlights (Quick pack) ----------
function renderExamHighlights(doc: jsPDF, questions: ExamQuestion[], grade: number) {
  let y = PAGE_TOP;
  const title = grade <= 7 ? "Test highlights" : "Exam highlights";
  y = drawSectionHeading(
    doc,
    y,
    title,
    "Most-asked questions. Attempt before peeking at the Full Pack.",
  );
  const top = questions.slice(0, 6);
  top.forEach((it, i) => {
    const w = contentWidth(doc);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const qLines = doc.splitTextToSize(`Q${i + 1}. ${it.question}`, w - 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const cueLines = doc.splitTextToSize(`Examiner expects: ${it.examinerExpects}`, w - 4);
    const h = 4 + qLines.length * 4.4 + cueLines.length * 3.8 + 4;
    y = ensureSpace(doc, y, h);
    // marks badge
    doc.setFillColor(INDIGO.r, INDIGO.g, INDIGO.b);
    doc.roundedRect(pageWidth(doc) - PAGE_MARGIN_X - 18, y + 1, 18, 5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(`${it.marks} mark${it.marks > 1 ? "s" : ""}`, pageWidth(doc) - PAGE_MARGIN_X - 9, y + 4.5, {
      align: "center",
    });
    // question
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(qLines, PAGE_MARGIN_X, y + 5);
    let yy = y + 5 + qLines.length * 4.4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(cueLines, PAGE_MARGIN_X, yy + 1);
    y += h;
  });
  y = ensureSpace(doc, y + 2, 6);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(
    "Full model answers, marking-scheme cues and time tips live in the Full Revision Pack.",
    PAGE_MARGIN_X,
    y + 3,
  );
}

// ---------- Full exam corner ----------
function renderExamCorner(doc: jsPDF, questions: ExamQuestion[], grade: number) {
  let y = PAGE_TOP;
  const subtitle =
    grade >= 9
      ? "CBSE Board / PYQ pattern with model answers and marking-scheme cues."
      : "School-test and Olympiad-style questions with model answers and tips.";
  y = drawSectionHeading(doc, y, grade <= 7 ? "Test & Olympiad corner" : "Exam corner", subtitle);
  questions.forEach((it, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK.r, INK.g, INK.b);
    const qLines = doc.splitTextToSize(`Q${i + 1}. ${it.question}`, contentWidth(doc) - 22);
    const titleH = qLines.length * 4.4;
    y = ensureSpace(doc, y, titleH + 6);
    // marks badge
    doc.setFillColor(INDIGO.r, INDIGO.g, INDIGO.b);
    doc.roundedRect(pageWidth(doc) - PAGE_MARGIN_X - 18, y + 1, 18, 5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(`${it.marks} mark${it.marks > 1 ? "s" : ""}`, pageWidth(doc) - PAGE_MARGIN_X - 9, y + 4.5, {
      align: "center",
    });
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(qLines, PAGE_MARGIN_X, y + 5);
    y += 5 + titleH;

    y = drawTintedBlock(
      doc,
      y,
      "Examiner expects",
      it.examinerExpects,
      { r: 245, g: 244, b: 252 },
      INDIGO,
    );
    drawLabel(doc, PAGE_MARGIN_X, y + 2, "Model answer");
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(INK.r, INK.g, INK.b);
    const ansLines = doc.splitTextToSize(it.modelAnswer, contentWidth(doc));
    for (const line of ansLines) {
      y = ensureSpace(doc, y, 4.2);
      doc.text(line, PAGE_MARGIN_X, y + 3);
      y += 4.2;
    }
    if (it.timeTip || it.source) {
      y = ensureSpace(doc, y + 1, 5);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
      const meta = [it.timeTip, it.source].filter(Boolean).join("  ·  ");
      doc.text(meta, PAGE_MARGIN_X, y + 3);
      y += 4;
    }
    y += 3;
  });
}

// ============================================================
// DOWNLOAD FUNCTIONS
// ============================================================

export function downloadRevisionPackPdf(opts: {
  grade: number;
  chapterTitle: string;
  cards: ConceptCard[];
  formulas: Formula[];
  // optional extras → when present, the Full Pack sections are appended
  pathway?: PathwayTopic[];
  topicLessons?: Array<{ topic: PathwayTopic; lesson: TopicLesson | null }>;
  solvedExamples?: SolvedExample[];
  examCorner?: ExamQuestion[];
}) {
  const isFull = !!(opts.pathway || opts.topicLessons || opts.solvedExamples || opts.examCorner);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const packId = makePackId();
  const cover = new Set<number>();
  drawCover(doc, { ...opts, kind: isFull ? "Full Revision Pack" : "Revision Pack", packId });
  cover.add(1);

  // 01 Concept Cards
  doc.addPage();
  drawSectionDivider(doc, "01", "Concept Cards", "Bite-sized ideas, examples and exam tips for fast revision.");
  cover.add(doc.getNumberOfPages());
  doc.addPage();
  renderConceptCards(doc, opts.cards, opts.chapterTitle, opts.grade, packId);

  // 02 Formula Sheet
  doc.addPage();
  drawSectionDivider(doc, "02", "Formula Sheet", "Every key formula, where it lives, and when to reach for it.");
  cover.add(doc.getNumberOfPages());
  doc.addPage();
  renderFormulaSheet(doc, opts.formulas);

  let sectionNo = 3;
  // 03 Learning Pathway
  if (opts.pathway && opts.pathway.length) {
    doc.addPage();
    drawSectionDivider(
      doc,
      String(sectionNo++).padStart(2, "0"),
      "Learning Pathway",
      "Tuition-class pacing: master the chapter one topic at a time.",
    );
    cover.add(doc.getNumberOfPages());
    doc.addPage();
    renderPathwayRoadmap(doc, opts.pathway);
    if (opts.topicLessons && opts.topicLessons.length) {
      opts.topicLessons.forEach((tl, i) => {
        renderTopicLesson(doc, i, tl.topic, tl.lesson, opts.grade);
      });
    }
  }

  // 04 Solved Examples
  if (opts.solvedExamples && opts.solvedExamples.length) {
    doc.addPage();
    drawSectionDivider(
      doc,
      String(sectionNo++).padStart(2, "0"),
      "Solved Examples",
      "Worked NCERT-textbook problems with method, steps and final answers.",
    );
    cover.add(doc.getNumberOfPages());
    doc.addPage();
    renderSolvedExamples(doc, opts.solvedExamples);
  }

  // 05 Exam Corner
  if (opts.examCorner && opts.examCorner.length) {
    const examTitle = opts.grade <= 7 ? "Test & Olympiad Corner" : "Exam Corner";
    doc.addPage();
    drawSectionDivider(
      doc,
      String(sectionNo++).padStart(2, "0"),
      examTitle,
      opts.grade >= 9
        ? "Board-pattern questions, examiner cues and model answers."
        : "School-test & Olympiad-style questions with model answers.",
    );
    cover.add(doc.getNumberOfPages());
    doc.addPage();
    renderExamCorner(doc, opts.examCorner, opts.grade);
  }

  finalizePages(doc, opts.chapterTitle, opts.grade, packId, cover);
  doc.save(fileName(opts.grade, opts.chapterTitle, isFull ? "Full-Pack" : "Revision-Pack"));
}

export function downloadQuickRevisionPackPdf(opts: {
  grade: number;
  chapterTitle: string;
  cards: ConceptCard[];
  formulas: Formula[];
  pathway?: PathwayTopic[];
  examCorner?: ExamQuestion[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const packId = makePackId();
  const cover = new Set<number>();
  drawCover(doc, { ...opts, kind: "Quick Revision Pack", packId });
  cover.add(1);

  doc.addPage();
  drawSectionDivider(doc, "01", "Concept Cards", "Bite-sized ideas, examples and exam tips for fast revision.");
  cover.add(doc.getNumberOfPages());
  doc.addPage();
  renderConceptCards(doc, opts.cards, opts.chapterTitle, opts.grade, packId);

  doc.addPage();
  drawSectionDivider(doc, "02", "Formula Sheet", "Every key formula, where it lives, and when to reach for it.");
  cover.add(doc.getNumberOfPages());
  doc.addPage();
  renderFormulaSheet(doc, opts.formulas);

  if (opts.pathway && opts.pathway.length) {
    doc.addPage();
    drawSectionDivider(doc, "03", "Pathway at a glance", "Your one-page chapter checklist.");
    cover.add(doc.getNumberOfPages());
    doc.addPage();
    renderPathwayAtAGlance(doc, opts.pathway);
  }

  if (opts.examCorner && opts.examCorner.length) {
    doc.addPage();
    drawSectionDivider(
      doc,
      "04",
      opts.grade <= 7 ? "Test highlights" : "Exam highlights",
      "Most-asked questions with examiner cues. Full answers in the Full Pack.",
    );
    cover.add(doc.getNumberOfPages());
    doc.addPage();
    renderExamHighlights(doc, opts.examCorner, opts.grade);
  }

  finalizePages(doc, opts.chapterTitle, opts.grade, packId, cover);
  doc.save(fileName(opts.grade, opts.chapterTitle, "Quick-Pack"));
}

export function downloadLearningPathwayPdf(opts: {
  grade: number;
  chapterTitle: string;
  pathway: PathwayTopic[];
  topicLessons: Array<{ topic: PathwayTopic; lesson: TopicLesson | null }>;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const packId = makePackId();
  const cover = new Set<number>();
  drawCover(doc, { ...opts, kind: "Learning Pathway", packId });
  cover.add(1);
  doc.addPage();
  drawSectionDivider(doc, "01", "Learning Pathway", "Topic-by-topic mini-lessons for this chapter.");
  cover.add(doc.getNumberOfPages());
  doc.addPage();
  renderPathwayRoadmap(doc, opts.pathway);
  opts.topicLessons.forEach((tl, i) => renderTopicLesson(doc, i, tl.topic, tl.lesson, opts.grade));
  finalizePages(doc, opts.chapterTitle, opts.grade, packId, cover);
  doc.save(fileName(opts.grade, opts.chapterTitle, "Learning-Pathway"));
}

export function downloadSolvedExamplesPdf(opts: {
  grade: number;
  chapterTitle: string;
  examples: SolvedExample[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const packId = makePackId();
  const cover = new Set<number>();
  drawCover(doc, { ...opts, kind: "Solved Examples", packId });
  cover.add(1);
  doc.addPage();
  drawSectionDivider(doc, "01", "Solved Examples", "Worked problems with method, steps and final answers.");
  cover.add(doc.getNumberOfPages());
  doc.addPage();
  renderSolvedExamples(doc, opts.examples);
  finalizePages(doc, opts.chapterTitle, opts.grade, packId, cover);
  doc.save(fileName(opts.grade, opts.chapterTitle, "Solved-Examples"));
}

export function downloadExamCornerPdf(opts: {
  grade: number;
  chapterTitle: string;
  questions: ExamQuestion[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const packId = makePackId();
  const cover = new Set<number>();
  const kind = opts.grade <= 7 ? "Test & Olympiad Corner" : "Exam Corner";
  drawCover(doc, { ...opts, kind, packId });
  cover.add(1);
  doc.addPage();
  drawSectionDivider(
    doc,
    "01",
    kind,
    opts.grade >= 9 ? "Board-pattern questions with model answers." : "School-test & Olympiad-style questions.",
  );
  cover.add(doc.getNumberOfPages());
  doc.addPage();
  renderExamCorner(doc, opts.questions, opts.grade);
  finalizePages(doc, opts.chapterTitle, opts.grade, packId, cover);
  doc.save(fileName(opts.grade, opts.chapterTitle, kind.replace(/\s+/g, "-")));
}


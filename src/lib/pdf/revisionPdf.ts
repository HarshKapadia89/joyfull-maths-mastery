import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ConceptCard, Formula } from "@/lib/quiz.functions";

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
    // @ts-expect-error
    const GState = doc.GState;
    doc.saveGraphicsState();
    if (GState) {
      // @ts-expect-error
      doc.setGState(new GState({ opacity: 0.06 }));
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

export function downloadRevisionPackPdf(opts: {
  grade: number;
  chapterTitle: string;
  cards: ConceptCard[];
  formulas: Formula[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const packId = makePackId();
  const cover = new Set<number>();
  drawCover(doc, { ...opts, kind: "Revision Pack", packId });
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

  finalizePages(doc, opts.chapterTitle, opts.grade, packId, cover);
  doc.save(fileName(opts.grade, opts.chapterTitle, "Revision-Pack"));
}

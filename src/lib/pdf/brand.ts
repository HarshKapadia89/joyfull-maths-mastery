/**
 * Shared HBK branding for every generated PDF in the app.
 * Watermark + cover + section dividers + headers/footers all live here.
 */
import jsPDF from "jspdf";

export const SCHOOL = "The H. B. Kapadia New High School";
export const TAGLINE = "HBK Maths Quest · Learn smart. Revise smarter.";
export const WATERMARK = "THE H. B. KAPADIA NEW HIGH SCHOOL";

export const INDIGO = { r: 67, g: 56, b: 202 };
export const VIOLET = { r: 124, g: 58, b: 237 };
export const GOLD = { r: 202, g: 162, b: 73 };
export const INK = { r: 24, g: 24, b: 35 };
export const MUTED = { r: 120, g: 120, b: 132 };
export const LINE = { r: 224, g: 224, b: 232 };
export const SUCCESS = { r: 16, g: 122, b: 87 };
export const WARN = { r: 217, g: 119, b: 6 };

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function makePackId(prefix = "HBK") {
  const y = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${y}-${rand}`;
}

export function fileName(grade: number | "all", title: string, suffix: string) {
  const g = grade === "all" ? "All" : `Grade-${grade}`;
  return `HBK-Maths_${g}_${slug(title)}_${suffix}.pdf`;
}

type GS = new (o: { opacity: number }) => unknown;
type DocLike = jsPDF & {
  GState?: GS;
  setGState?: (s: unknown) => void;
};

function withOpacity(doc: jsPDF, opacity: number, fn: () => void) {
  const d = doc as DocLike;
  doc.saveGraphicsState();
  if (d.GState && d.setGState) d.setGState(new d.GState({ opacity }));
  fn();
  doc.restoreGraphicsState();
}

/** Tiled diagonal "THE H. B. KAPADIA NEW HIGH SCHOOL" watermark. */
export function drawWatermark(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  withOpacity(doc, 0.07, () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(INDIGO.r, INDIGO.g, INDIGO.b);
    const stepX = 95;
    const stepY = 38;
    for (let y = -20; y < h + stepY; y += stepY) {
      for (let x = -40; x < w + stepX; x += stepX) {
        const ox = (Math.floor((y + 20) / stepY) % 2) * (stepX / 2);
        doc.text(WATERMARK, x + ox, y, { angle: 30 });
      }
    }
  });
}

export function drawHeader(doc: jsPDF, line2: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setDrawColor(LINE.r, LINE.g, LINE.b);
  doc.setLineWidth(0.2);
  doc.line(12, 14, w - 12, 14);

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
  doc.text("HBK Maths Quest", 20, 11.6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(line2, w - 12, 10, { align: "right" });
}

export function drawFooter(doc: jsPDF, packId: string, pageNum: number, total: number) {
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
  doc.text(`Page ${pageNum} / ${total}`, w - 12, h - 7, { align: "right" });
}

/**
 * Apply watermark + (optional) header + footer to every page.
 * Pages listed in `coverPages` skip the header (already styled).
 */
export function finalizePages(
  doc: jsPDF,
  headerLine: string,
  packId: string,
  coverPages: Set<number> = new Set(),
) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawWatermark(doc);
    if (!coverPages.has(i)) drawHeader(doc, headerLine);
    drawFooter(doc, packId, i, total);
  }
}

/** Premium cover page (indigo→violet gradient + gold crest). */
export function drawCover(doc: jsPDF, opts: {
  kind: string;
  title: string;
  subtitle?: string;
  packId: string;
}) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
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

  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(SCHOOL, cx, 88, { align: "center" });

  doc.setFillColor(GOLD.r, GOLD.g, GOLD.b);
  doc.rect(cx - 18, 94, 36, 1.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(opts.kind.toUpperCase(), cx, 103, { align: "center" });

  const bodyY = bandH + 24;
  if (opts.subtitle) {
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(opts.subtitle.toUpperCase(), cx, bodyY, { align: "center" });
  }
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(INK.r, INK.g, INK.b);
  const titleLines = doc.splitTextToSize(opts.title, w - 40);
  doc.text(titleLines, cx, bodyY + 12, { align: "center" });

  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(TAGLINE, cx, h - 32, { align: "center" });

  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(`${opts.packId}   ·   ${today}`, w - 14, h - 22, { align: "right" });
}

export function drawSectionDivider(doc: jsPDF, num: string, title: string, sub: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(245, 244, 252);
  doc.rect(0, 0, w, h, "F");
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

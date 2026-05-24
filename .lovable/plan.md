## 1) Make the Revision Pack PDF stunning + add HBK watermark

**File:** `src/lib/pdf/revisionPdf.ts` (rewrite render layer; keep public API: `downloadConceptCardsPdf`, `downloadFormulaSheetPdf`, `downloadRevisionPackPdf`)

### Visual upgrade
- **Cover page**: deep indigo→violet gradient (simulated via stacked thin rects), large embossed "HBK" monogram inside a double-ring crest, gold foil-style accent bar, chapter title in serif display (Times) with kicker "REVISION PACK · GRADE N", date + unique pack ID (e.g. `HBK-2026-XXXX`) bottom-right for authenticity.
- **Section dividers**: full-bleed colored band pages before "Concept Cards" and "Formula Sheet" with oversized numerals (01 / 02) and a one-line intro.
- **Concept cards**: redesigned tile — colored left rail (rotating palette per card: indigo, emerald, amber, rose), white card body with subtle shadow rect, icon glyph, "KEY IDEA / EXAMPLE / WATCH OUT / EXAM TIP" as small-caps labels with hairline dividers, generous padding, auto-resize text to avoid clipping.
- **Formula sheet**: two-tone zebra table, monospace formula column on a tinted chip, category grouping headers, "When to use" in italic muted text.
- **Header/footer on every content page**: thin top rule + HBK wordmark left, chapter · grade center, page X / Y right; footer with school tagline and confidentiality line.
- **Typography**: Helvetica for UI text, Times for display headings (both built-in to jsPDF — no font loading needed, keeps it fast and reliable).

### Watermark (security)
- Diagonal repeating watermark "THE H. B. KAPADIA NEW HIGH SCHOOL" rendered at ~8% opacity, 45° rotation, tiled across the full page behind all content on **every page including cover**.
- Implemented via `doc.saveGraphicsState() → setGState(new GState({opacity: 0.08})) → rotated text grid → restoreGraphicsState()`.
- Also stamp a small student-pack ID + generation timestamp in the footer for traceability.
- Render watermark FIRST per page (before content) so text stays legible on top.

### Robustness
- Long text → `splitTextToSize` + dynamic card height (no more fixed 70mm clipping for deep dive cards).
- Page-break aware: cards flow to new pages with header re-drawn automatically.
- All this stays client-side (jsPDF) — no server cost, instant download.

---

## 2) Suggested next features for student benefit

Grouped by impact. Happy to build any subset next.

**Learning depth**
- **Step-by-step solution walkthroughs** — on wrong answer, expand to a numbered 3–5 step solution (not just "why wrong"), with a "Try a similar one" button that generates a twin question.
- **Worked example videos via text** — AI-generated short "teacher voice" explanations students can read like a transcript.
- **Misconception library per chapter** — auto-collected from wrong answers across attempts.

**Practice & mastery**
- **Adaptive difficulty** — quiz auto-adjusts (easy/medium/hard) based on last 5 answers.
- **Mastery meter per concept** (not just per chapter) — e.g. "Linear equations: 80%, Word problems: 40%".
- **Spaced revision queue** — home-screen "Revise today" card surfacing weakest concepts on SM-2 schedule.
- **Mock exam mode** — timed full-syllabus paper with HBK-branded PDF result sheet.
- **Previous year question bank** — chapter-tagged PYQs with MCQ conversion.

**Engagement & habit**
- **Daily streaks + XP + badges** ("7-day streak", "Algebra Ace", "100 MCQs club").
- **Leaderboard (opt-in, class-level)** with display name only.
- **Parent weekly digest** (PDF or email) — time spent, accuracy, weak areas.

**Tools**
- **HBK Doubt-Solver chat** — already have tutor route; add image upload so students photograph a problem.
- **Formula flashcards mode** — swipeable spaced-repetition cards from the formula sheet.
- **Offline mode** — cache concept cards + last 50 questions in localStorage for no-network practice.
- **Printable worksheet generator** — pick chapter + count → branded PDF with answer key on last page.

**Teacher/admin (future)**
- Teacher accounts with class roll, assign chapters, view aggregate weak topics.
- Custom test sharing via link (`/t/abc123`) so teachers send a test to a class.

**Accessibility & polish**
- Hindi/Gujarati toggle for question stems (Lovable AI translate).
- Larger-text mode + dyslexia-friendly font option.

---

### Technical notes
- PDF rewrite touches only `src/lib/pdf/revisionPdf.ts`; callers unchanged.
- jsPDF `GState` for opacity is supported in current `jspdf` version already in `package.json` — no new deps.
- Watermark text grid: ~6 rows × 3 columns, recalculated per page size.

Tell me which feature(s) from section 2 to queue after the PDF rework, or say "just the PDF" and I'll ship that alone.
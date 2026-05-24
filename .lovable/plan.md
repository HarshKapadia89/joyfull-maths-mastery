# Plan: PDF revision pack + strict MCQ-only quizzes

## 1) Concept cards & formula sheet → branded PDF download

Add a **"Download PDF"** button on both the *Concept cards* and *Formula sheet* tabs in `src/components/chapter/ConceptCards.tsx`. One combined PDF per chapter (cards + formulas + cover), plus the option to download each individually.

**Branding (prominent, on every page):**
- Header: **"The H. B. Kapadia New High School"** in bold, with a sub-line "HBK Maths Quest · Revision Pack".
- Cover page: school name large, chapter title, grade, date, and a tagline ("Learn smart. Revise smarter.").
- Footer on every page: school name (left) + page number (right) + small note "For internal student use".
- Accent color bar matching the app's primary token.
- (Optional) school logo slot — if a logo file is added later under `src/assets/`, drop it into the header; until then use a typographic crest ("HBK") in a circle.

**How:**
- Use **`jspdf` + `jspdf-autotable`** (lightweight, pure-JS, works in the browser, no server work). Install via `bun add jspdf jspdf-autotable`.
- New helper `src/lib/pdf/revisionPdf.ts` exporting:
  - `downloadConceptCardsPdf({ grade, chapterTitle, cards })`
  - `downloadFormulaSheetPdf({ grade, chapterTitle, formulas })`
  - `downloadRevisionPackPdf({ grade, chapterTitle, cards, formulas })` ← combined
- Concept cards rendered as boxed cards (Title, Key idea, Example, Watch out, Exam tip) two per row.
- Formula sheet rendered as a 3-column table (Name · Formula · When to use) via `autoTable`.
- File name: `HBK-Maths_Grade-{g}_{slug(chapter)}_Revision-Pack.pdf`.
- Buttons added in `ConceptCards.tsx`: "Download cards PDF", "Download formula sheet PDF", and a primary "Download full revision pack". The current "Print formula sheet" button is replaced by the PDF button.

## 2) Force MCQ everywhere (fix "questions still not all MCQ")

The server already restricts generation to MCQ, but two things still cause non-MCQ behaviour for the student:

a. **Stale cached quizzes** in `localStorage` (daily, custom, chapter) generated before the MCQ-only switch — they may contain `fill_blank` / `short_answer` items, which fall through `QuizRunner` to the **text input** branch.
b. **Defensive fallback** in `QuizRunner` itself renders a typing input whenever `q.options` is missing.

**Fixes:**
- Bump cache keys to invalidate old data:
  - `hbk-daily-` → `hbk-daily-v2-`
  - chapter quiz key → add `-v2`
  - any custom-test cache → `-v2`
- In `QuizRunner.tsx`, **remove the text-input fallback entirely**. If a question somehow lacks 4 options, skip it (or show a friendly "Question unavailable, click Next") — never show a typing box.
- Add a client-side guard in the three quiz entry points (`daily.tsx`, `custom.tsx`, chapter quiz route) that filters loaded questions to `q.type === "mcq" && q.options?.length === 4 && q.options.includes(q.answer)` before passing to `QuizRunner`. If the filtered list is empty, auto-regenerate.

## 3) MCQ UX: 4 tappable option cards (no typing)

`QuizRunner` already renders option buttons for MCQs — the work here is polish + ensuring it's the only path:

- Render the 4 options as a **2×2 grid** (1 column on mobile) of large tap targets with A / B / C / D badges on the left.
- Bigger hit area (min 56px height), bold option text, hover/active states already in the design tokens.
- After submit: correct option turns green with a check, picked-wrong option turns red with an ✗, the other two dim — same as today but with the new layout.
- Keyboard shortcuts: pressing **1–4** or **A–D** selects an option.
- Remove the `<form>` text-input branch (per item 2).

## Files touched

- `src/lib/pdf/revisionPdf.ts` *(new)* — branded PDF builder
- `src/components/chapter/ConceptCards.tsx` — PDF download buttons, remove print button
- `src/components/quiz/QuizRunner.tsx` — drop text-input fallback, 2×2 MCQ grid with A/B/C/D, keyboard shortcuts
- `src/routes/daily.tsx`, `src/routes/custom.tsx`, `src/routes/grade.$gradeId.chapter.$chapterId.tsx` — bump cache key + MCQ-validity filter on load
- `package.json` — add `jspdf`, `jspdf-autotable`

## Technical notes

- jsPDF runs entirely client-side, so no server function changes are needed for PDFs.
- Combined revision pack triggers both `generateConceptCards` (deep, 8 cards) and `generateFormulaSheet` in parallel via `Promise.all` before building the PDF, so the user gets the richest content even if they only opened the "Quick" tab.
- No DB/schema changes.
- Logo: if you'd like the actual school crest in the PDF, share the image and I'll embed it; otherwise the typographic "HBK" crest ships as default.

## Open question

Do you want **one combined "Revision Pack" PDF** (cover + cards + formulas) as the primary button, with individual downloads as secondary — or three equal buttons?

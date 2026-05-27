# Goal

Offer **two downloadable PDFs** from every chapter, across all grades (1–10) and all chapters:

1. **Quick Revision Pack** — short gist, fast to print, fits in a school bag. Concept Cards + Formula Sheet + a one-page summary of the Learning Pathway + the most-asked Exam Corner highlights. Roughly 6–12 pages.
2. **Full Revision Pack** — the complete tuition handout. Concept Cards + Formula Sheet + full topic-by-topic Learning Pathway lessons + all Solved Examples + full Exam Corner. Roughly 30–60 pages depending on chapter density.

Both are additive. The existing Concept Cards and Formula Sheet PDFs (already downloadable separately) stay exactly as they are.

---

## 1. UI on the chapter page

Inside `ConceptCards.tsx`, replace the single "Download Revision Pack" button with a small **download menu** (dropdown or two adjacent buttons):

- **Quick Pack (PDF)** — secondary button, lightning icon. Subtitle: "Cards + formulas + one-page summary".
- **Full Pack (PDF)** — primary button, book icon. Subtitle: "Everything: pathway, solved examples, exam corner".

The existing per-tab "Download this section" links stay for power users who want just one section.

## 2. Quick Revision Pack — what's inside

Designed to be the "exam-eve cheat sheet". Compact, dense, high signal.

```text
Cover  ▸  01 Concept Cards (compact 2-column, today's style)
       ▸  02 Formula Sheet (today's style)
       ▸  03 Pathway at a Glance     ← NEW, single page
       ▸  04 Exam Highlights          ← NEW, 1–2 pages
```

- **Pathway at a Glance** (1 page) — numbered list of all topics in the chapter, each with a one-line "what you'll learn" caption. No derivations, no worked examples. Acts as a study checklist.
- **Exam Highlights** (1–2 pages) — top 4–6 PYQ / Board-pattern questions (Grades 9–10) or top tricky test questions (Grades 1–7), each as a tight card with the question, marks badge, and a 2–3 line "Examiner expects" cue. No full model answers in Quick Pack — keeps it short and forces active recall.

Routing: Quick Pack only needs the pathway *index* (already returned by `generateChapterPathway`) and the Exam Corner payload — **no per-topic lesson fetches**, so it's near-instant when Concept Cards + Formula Sheet are already cached.

## 3. Full Revision Pack — what's inside

```text
Cover  ▸  01 Concept Cards
       ▸  02 Formula Sheet
       ▸  03 Learning Pathway      ← full mini-lessons, one topic per page(s)
       ▸  04 Solved Examples       ← all 6–10 worked problems
       ▸  05 Exam Corner           ← all questions + model answers + tips
                                   (renamed "Test & Olympiad Corner" for Grades 1–7)
```

Each new section gets the same premium treatment as today's two: dedicated section divider page (oversized numeral), watermark, headers, footers, pack ID, A4 layout, indigo→violet→gold palette.

### Learning Pathway rendering (Full Pack only)

- Roadmap overview page (numbered vertical list with gold connector).
- Then one mini-lesson per topic: Prerequisites · Intuition · Definition · Derivation/Why (becomes "Visual idea" for Grades 1–7) · 2–3 Worked Examples (Given/Method/Steps/Boxed answer) · Common Mistakes · Practice Check (answers in light grey below) · "What's next →".

### Solved Examples rendering (Full Pack only)

- Grouped Easy / Medium / Hard. Each card: Given · To find · Method (with rationale) · Step-by-step · Alternate method when present · Boxed final answer.

### Exam Corner rendering (Full Pack only)

- Question card with marks badge · "Examiner expects" callout · full model answer · time tip · source tag (CBSE PYQ / Exemplar / Board pattern). Grades 1–7 use difficulty badges + Olympiad-style hint where present. Section ends with "Most-asked sub-topics".

## 4. Data flow & caching

Both packs read from the **same localStorage cache** the in-app tabs already write to:

- `pathway:{grade}:{chapter}` — pathway index (used by both packs)
- `pathway-lesson:{grade}:{chapter}:{topic}` — per-topic lesson (Full Pack only)
- `solved:{grade}:{chapter}` — solved examples (Full Pack only)
- `exam:{grade}:{chapter}` — exam corner (both packs)

Pack assembly logic:

1. Check localStorage for every payload the pack needs.
2. Anything missing is fetched live with a progress toast: "Building your Full Pack… (2/4 Pathway lessons, topic 3 of 7)".
3. Per-topic lessons fetch in parallel, capped at 3 concurrent calls.
4. If a section fails after retry, the PDF still generates with the rest and a small "Section unavailable — please retry" placeholder. The user never loses the other sections.

Quick Pack will almost always finish in seconds. Full Pack on a cold cache for a dense Grade 10 chapter can take ~20–40s — the progress toast makes that wait understandable.

## 5. Grade calibration

Handled upstream in the AI prompts (already in place). The PDF renderer only:

- Renames Exam Corner heading to **"Test & Olympiad Corner"** when `grade <= 7`.
- Renames the Derivation block to **"Visual idea"** when `grade <= 7`.

## 6. Standalone per-section PDFs

In addition to Quick / Full packs, keep the existing standalone downloads (`downloadConceptCardsPdf`, `downloadFormulaSheetPdf`) and add two thin helpers used by the new tabs:

- `downloadLearningPathwayPdf` — cover + roadmap + all topic lessons.
- `downloadExamCornerPdf` — cover + Exam Corner section only.

So a student can print just one section without building either pack.

---

## Technical details

**Files touched**

- `src/lib/pdf/revisionPdf.ts`
  - Add renderers: `renderPathwayRoadmap`, `renderTopicLesson`, `renderSolvedExamples`, `renderExamCorner`, plus compact variants `renderPathwayAtAGlance` and `renderExamHighlights` for the Quick Pack.
  - Add `downloadQuickRevisionPackPdf({ grade, chapterTitle, cards, formulas, pathwayIndex, examCorner })`.
  - Extend existing `downloadRevisionPackPdf` → renamed call-site "Full Pack" with optional `pathway`, `topicLessons`, `solvedExamples`, `examCorner`. Existing arg shape preserved by making the new fields optional, so any other caller keeps working.
  - Add `downloadLearningPathwayPdf` + `downloadExamCornerPdf`.
  - No changes to `renderConceptCards`, `renderFormulaSheet`, cover, divider, header, footer, watermark.
- `src/components/chapter/ConceptCards.tsx`
  - Replace single download button with **Quick Pack / Full Pack** controls.
  - Orchestrate cache-first fetch with progress toast.
  - Add per-tab "Download this section as PDF" buttons inside the Pathway / Solved / Exam Corner tabs.
- `src/components/chapter/DeepLearning.tsx`
  - Export a tiny `useDeepLearningCache(grade, chapter)` hook so `ConceptCards.tsx` can read / lazily fetch the payloads without duplicating logic.
- No changes to `src/lib/quiz.functions.ts`. No migrations. No route changes.

**Schema reuse** — All payloads already have Zod schemas in `quiz.functions.ts` (`PathwaySchema`, `TopicLessonSchema`, `SolvedExampleSchema`, `ExamCornerSchema`). PDF code reads from those typed shapes only.

**Filenames**

- `HBK-Maths_Grade-{n}_{chapter-slug}_Quick-Pack.pdf`
- `HBK-Maths_Grade-{n}_{chapter-slug}_Full-Pack.pdf`

## Open questions

1. **Quick Pack — include model answers in Exam Highlights, or keep it answer-free for active recall?** Default I'd pick: **answer-free** (forces the student to attempt before checking the Full Pack), with a small footer line "Full answers in the Full Revision Pack".
2. **Full Pack on cold cache** — fetch everything live with a progress UI (one click, slower), or refuse and ask the student to open the relevant tab first? Default: **fetch live** — one click should always work.
3. **Page budget for Quick Pack** — hard-cap at 12 pages even if Concept Cards alone would overflow (e.g. very long chapter), or let it grow naturally? Default: **let it grow** — Quick Pack stays "short relative to Full", not strictly under N pages.

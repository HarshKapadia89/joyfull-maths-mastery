
# Goal

Add a **deep, tuition-class-grade learning layer** on top of the existing chapter experience — without removing or shrinking any current functionality. Concept cards, formula sheet, quizzes, worksheets, tutor, mistake explanations all stay exactly as they are. We **add** richer content and a structured topic-by-topic learning pathway.

---

## 1. Topic-based learning pathway (the new "Theory & Concepts" surface)

This is the centrepiece of the upgrade. Instead of dumping a wall of theory per chapter, every chapter gets broken into an ordered list of **topics** (sub-concepts), and each topic is taught in its own mini-lesson — the way a tuition teacher actually paces a chapter across multiple sittings.

New server function `generateChapterPathway(grade, chapterTitle)` returns:

```text
Chapter → ordered Topics[]  (e.g. for Grade 10 Quadratic Equations:
  1. What is a quadratic equation?
  2. Standard form & roots
  3. Solving by factorisation
  4. Solving by completing the square
  5. Quadratic formula & discriminant
  6. Nature of roots
  7. Word problems / applications)
```

For each topic, a second function `generateTopicLesson(grade, chapterTitle, topicTitle)` produces a full mini-lesson:

- **Prerequisites** (with link back to which earlier chapter/topic to revise)
- **Intuition** — why this concept exists, real-life analogy
- **Definition / statement** — formal
- **Derivation or proof** (Grades 8–10) / **Why it works visually** (Grades 1–7)
- **2–3 fully worked examples**, easy → hard, each with method choice + steps + final answer
- **Common mistakes** specific to this topic
- **Practice check** — 2 quick self-check questions with answers hidden by default
- **"What's next"** — pointer to the next topic in the pathway

UI: a new **"Learning Pathway"** tab inside `ConceptCards.tsx` (added alongside existing "Concept cards" and "Formula sheet" tabs — neither is removed). The pathway renders as a vertical numbered roadmap; clicking a topic lazy-loads its lesson and marks it complete (stored in localStorage per grade/chapter/topic, so a student can resume).

A small **progress bar** above the roadmap shows "3 / 7 topics complete" — gives a real sense of progression through the chapter.

## 2. Two more additive deep-content surfaces

Same additive pattern — new tabs, no removal:

| New tab | New server fn | What it produces |
|---|---|---|
| **Solved Examples** | `generateSolvedExamples` | 6–10 fully worked problems graded easy → hard, each with given/to-find, method + why, step-by-step solution, alternate method where useful, boxed final answer. NCERT textbook style. |
| **Exam Corner** | `generateExamCorner` | PYQ/Board-pattern questions (Grades 9–10), or school-test/Olympiad-style for lower grades. Includes marking-scheme hints, "what the examiner expects", time tips, most-asked sub-topics. |

Both cached in localStorage per chapter, lazy-loaded on tab open.

## 3. Prompt enrichment for existing surfaces (additive, not destructive)

Existing prompts stay; we **extend** them so the AI is allowed/required to go deeper when the field is present. No fields are removed from any schema.

- `generateConceptCards` — add optional fields `derivation`, `prerequisites`, `relatedTopics` (rendered only when present). Existing `keyIdea / example / pitfall / examTip` stay.
- `generateFormulaSheet` — add optional `derivation`, `conditions` (when valid / not valid), `commonMistake`, `relatedFormula`. Existing `name / formula / whenToUse` stay.
- `generateChapterQuiz` — add a Bloom's mix instruction (recall / application / HOTS) and require 3–5 line method-showing explanations. Question count and structure unchanged.
- `generateWorksheet` — keep current marks bands; add instruction that 5-mark questions should be Board-exam-style case studies with sub-parts (a)(b)(c).
- `askTutor` — system prompt becomes a full tutor persona (teach the concept, then a worked example, then a check-for-understanding question). Existing chat UI unchanged.
- `explainMistake` — append a "prerequisite to revise" pointer so a wrong answer routes the student to the right earlier topic in the pathway.

Grade calibration runs through every prompt: Grades 1–5 use story / visual analogies (no formal derivations); Grades 6–8 introduce formal notation gently; Grades 9–10 use full Board-exam rigour with proper derivations and CBSE marking-scheme style. For Grades 1–7 "Exam Corner" becomes "Test & Olympiad Corner" since there's no Board exam.

## 4. Mastery-aware depth

`suggestDifficulty` already exists. Add `suggestStudentLevel` (beginner / developing / proficient) derived from the same mastery data, and pass it into the tutor + pathway prompts so a struggling student gets more scaffolding and prerequisite reminders, a proficient one gets harder variations and competitive-exam-style extensions. Default behaviour for new users is unchanged.

## 5. Model routing

All deep-content generators (`generateChapterPathway`, `generateTopicLesson`, `generateSolvedExamples`, `generateExamCorner`) route to `MODEL_REASONING` (`google/gemini-2.5-pro`) since derivation/proof accuracy matters most. Quiz + worksheet bulk stays on `MODEL_FAST`. Existing routing unchanged.

## 6. PDF pack

`downloadRevisionPackPdf` is **extended** (not replaced) to optionally append the Learning Pathway, Solved Examples, and Exam Corner sections when they're already cached, so the printable pack becomes a true tuition handout. Original cards + formulas sections remain identical.

---

## Files touched

- `src/lib/quiz.functions.ts` — **add** 4 new server functions, **extend** (not remove) 6 existing prompts/schemas with optional richer fields.
- `src/components/chapter/ConceptCards.tsx` — **add** 3 new tabs (Learning Pathway, Solved Examples, Exam Corner). Existing tabs untouched.
- `src/components/chapter/LearningPathway.tsx` — **new** component for the roadmap UI with per-topic completion tracking.
- `src/lib/pdf/revisionPdf.ts` — extend the pack PDF with new sections.
- `src/lib/mastery.ts` — add `suggestStudentLevel` helper. Existing exports unchanged.
- `src/routes/tutor.tsx` — pass available grade + chapter context to `askTutor` (no UI change).

No database migrations. No routes removed. No existing UI removed. Cache keys for the *modified* (additive) prompts bump from `v2` → `v3` so users see the richer output once; old caches simply re-fetch.

## Open questions

1. **Pathway granularity** — should I aim for ~5–7 topics per chapter (concise) or ~8–12 (more granular)? I'll default to "as many as the NCERT chapter naturally has" unless you prefer a fixed range.
2. **Olympiad/competitive content for Grades 9–10** — include NTSE / JEE-Foundation-style stretch questions in Exam Corner, or keep strictly to CBSE Board style?
3. **Hinglish option** — keep all explanations English-only (current), or add a per-user toggle for Hinglish in the tutor + pathway lessons?

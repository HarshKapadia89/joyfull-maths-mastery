## 1. Make revision more comprehensive (Concept Cards & beyond)

Today: a single collapsible panel with 4 generic "Key idea / Example / Watch out" cards per chapter. Good as a quick recap, but thin for real revision.

Proposed upgrades (pick any subset — recommend A + B + C for biggest impact):

**A. Richer Concept Cards (per chapter)**
- Expand to 6–8 cards covering: definition, formula, worked example, common mistake, "exam tip", and 1 quick check-in question.
- Add a **Formula sheet** tab next to cards — pulled from the same chapter, printable.
- Add a **"Try this"** mini-question at the bottom of each card (1 MCQ inline, instant feedback) so revision is active, not passive.
- Difficulty toggle on cards: *Quick recap (4)* / *Deep dive (8)*.

**B. New "Revision Hub" route (`/revise/grade/:g/chapter/:c`)**
One place per chapter that brings everything together:
- Concept cards (from A)
- Formula sheet
- 5-question "Warm-up" quiz (auto-generated, cached)
- "Common mistakes in this chapter" (pulled from the student's own mistake bank)
- "Ready for the test?" CTA → opens the 25-question chapter quiz

**C. Smart spaced revision**
- Track which chapters the student has practised and when. On the home screen show: *"Time to revise: Fractions (last seen 5 days ago)"*.
- Auto-resurface mistakes from the mistake bank after 1 day, 3 days, 7 days (lightweight SRS, all in localStorage).

**D. Optional extras** (nice-to-haves, defer if scope grows)
- Audio "Read aloud" button on each concept card (browser TTS, no extra API).
- Chapter glossary (key terms + 1-line meaning).
- "Prerequisites" line at the top of each chapter ("Before this, revise: …").

## 2. Fix & upgrade Custom Test

Today: single grade + single chapter dropdown + question-count slider. User reports the marks/count picker feels broken, and only one chapter can be picked.

Changes to `src/routes/custom.tsx`:
- **Multi-chapter selection**: replace the single chapter `<select>` with a scrollable checklist of all chapters for the chosen grade. Each row = checkbox + chapter number + title. Add *Select all / Clear* buttons.
- **Marks/question count**: keep a slider but also show a numeric stepper (−/+) and quick chips (10 · 20 · 30 · 50). Show *"≈ X marks (1 mark each)"* so it reads as marks, not just count.
- **Distribution**: when N chapters are picked and M questions requested, split M roughly evenly across chapters (e.g. 30 questions across 3 chapters = 10 each). Fire the chapter quizzes **in parallel** via `Promise.all` and merge + shuffle the results before handing to `QuizRunner`.
- **Validation**: disable "Start" until ≥1 chapter is ticked; show how many questions per chapter will be generated.
- **Result tracking**: when finished, record results against each contributing chapter proportionally so progress still updates correctly.

This also incidentally fixes the "marks selection not working" feel — the slider value will be visibly bound to a stepper and chips, and the *Start* button label will read *"Start test · 30 questions"*.

## 3. Auto-show wrong-answer explanation

Today: when the student picks the wrong option, `QuizRunner` shows the short canned `q.explanation`, plus a button *"Explain why I got this wrong"* that calls the AI. User wants the deeper explanation to appear automatically, in a box right below the question.

Changes to `src/components/quiz/QuizRunner.tsx`:
- On a wrong answer, **auto-trigger** `explainMut.mutate(...)` (no button click needed) when `context` is present.
- Render a dedicated "Why this is wrong" box below the answer feedback:
  - While loading: show *"HBK Mathy is explaining…"* with a small spinner.
  - On success: show the full AI explanation in the existing `bg-primary/5` box.
  - On error: show the fallback short `q.explanation` only (no scary toast).
- Keep the button as a *"Re-explain"* / *"Explain differently"* affordance for students who want another angle.
- Make sure this only fires on wrong answers (not on correct), and only once per question.

## Technical notes

- All new revision pieces stay client-side + localStorage; no DB changes needed.
- Multi-chapter custom test = N parallel calls to existing `generateChapterQuiz` — no new server function required (the chapter quiz already runs as 2 parallel sub-batches, so a 3-chapter / 30-question test = 6 parallel AI calls, still fast).
- Auto-explain reuses the existing `explainMistake` server function; only the trigger moves from click → effect.
- New route `revise.grade.$g.chapter.$c.tsx` will compose existing components (`ConceptCards`, mistake bank, `QuizRunner`).

## Suggested rollout order

1. Auto-show wrong-answer explanation (smallest, highest daily impact).
2. Custom Test: multi-chapter checklist + marks stepper + parallel generation.
3. Concept Cards expansion (A) + Formula sheet.
4. Revision Hub route (B) + mistakes-by-chapter view.
5. Spaced revision nudges on home (C).
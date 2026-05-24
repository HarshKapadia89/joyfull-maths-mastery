# Fix: chapters open but no questions appear

## Problem

Clicking a chapter navigates to `/grade/:gradeId/chapter/:chapterId` but the quiz never shows. Root causes in `src/routes/grade.$gradeId.chapter.$chapterId.tsx`:

1. The component hacks react-query state by writing `(mutation as any).data = parsed` from a `useEffect`. React doesn't see this as a state change, so cached questions never render.
2. When there's no cache, `mutation.mutate()` is fired in an effect with no surfaced error UI if the AI gateway call quietly hangs/fails (no toast, no retry button visible until the mutation actually errors).
3. `localStorage` is read during render on every keystroke — fine for SSR-safety but combined with (1) makes the data flow unreliable.

Bonus bug in `src/components/quiz/QuizRunner.tsx`: `onComplete(score + (submitted && correct ? 0 : 0), total)` — the last question's correct answer is never added to the reported score (off-by-one on results).

## Fix

### 1. Rewrite the chapter route to use `useQuery` properly
- Replace `useMutation` + manual cache hack with `useQuery`:
  - `queryKey: ['chapter-quiz', grade, chapterId]`
  - `queryFn`: call `generateChapterQuiz` server fn, then write result to `localStorage`
  - `initialData`: synchronously read `localStorage` on mount (guarded for SSR)
  - `staleTime: Infinity` so it never refetches automatically
- "New set" button → `localStorage.removeItem(key)` + `queryClient.invalidateQueries(...)` + `refetch()`.
- Keep the existing loading / error UI; error path shows message + retry.

### 2. Fix QuizRunner score reporting
- Track the final correct answer before calling `onComplete`. Pass `score` (already updated via `setScore`) using a ref or compute `nextScore` locally in `check()` and use that when `done` triggers.

### 3. No changes to
- `src/lib/quiz.functions.ts` (server fn already works; AI gateway + Zod validation in place)
- `src/data/ncert-maths.ts`, grade themes, home page, navigation
- `useProgress` hook

## Files touched
- `src/routes/grade.$gradeId.chapter.$chapterId.tsx` — rewrite data-fetch with `useQuery` + localStorage `initialData`
- `src/components/quiz/QuizRunner.tsx` — fix off-by-one score on completion

## Out of scope
Per-grade mascots, confetti, mobile nav polish, custom test builder, tutor streaming improvements.

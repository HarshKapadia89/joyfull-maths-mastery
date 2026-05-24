# Plan

## 1. Verify quizzes are live across all grades/chapters
The chapter quiz route (`/grade/:gradeId/chapter/:chapterId`) already:
- Renders via `<Outlet />` from `grade.$gradeId.tsx` (fix from previous turn).
- Calls `generateChapterQuiz` server function which uses Lovable AI (`google/gemini-3-flash-preview`) to generate 25 NCERT-aligned questions for any grade (1–10) and any chapter title from `src/data/ncert-maths.ts`.
- Caches results in `localStorage` so each chapter loads instantly after first generation.

Verification step (no code change expected):
- Spot-check 3 chapters from different grades (e.g. Grade 1 Ch 1, Grade 6 Ch 5, Grade 10 Ch 8) by navigating in the preview, confirming the loading spinner appears, then 25 questions render.
- Check server logs for any AI gateway errors (rate limit, validation). If errors appear, tighten the system prompt / schema in `src/lib/quiz.functions.ts`.
- If a specific grade/chapter fails, fix only that case (e.g. add fallback when AI returns <1 question, or relax the count for shorter chapters).

No structural changes are planned unless verification reveals a real failure.

## 2. Hide the Lovable badge
Use `publish_settings--set_badge_visibility` with `hide_badge: true`. This requires Pro plan or higher; the call will surface a clear error if the workspace isn't eligible, and I'll relay that to you.

## Out of scope
- No new features, no UI redesign, no auth changes.

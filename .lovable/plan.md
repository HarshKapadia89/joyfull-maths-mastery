I found the core routing problem: the chapter route is nested under the grade route, but `src/routes/grade.$gradeId.tsx` does not render an `<Outlet />`, so `/grade/9/chapter/2` still shows the grade chapter list instead of the quiz component.

Plan:
1. Update `src/routes/grade.$gradeId.tsx` so it detects when a child chapter route is active and renders the child route through `<Outlet />` instead of the grade chapter list.
2. Keep the current grade overview unchanged for `/grade/:gradeId`.
3. Fix `src/components/quiz/QuizRunner.tsx` score completion logic so the final answer is counted reliably.
4. Verify `/grade/9/chapter/2` shows the loading/questions UI instead of the grade list, and that chapter links across grades navigate into the quiz page.
## Current state

All AI calls go through Lovable AI Gateway (`src/lib/quiz.functions.ts`):

- `MODEL = "google/gemini-2.5-flash-lite"` — used by tutor chat, step-by-step solver, quiz generation, worksheet generation, misconception clustering
- `"google/gemini-2.5-flash"` — used only by photo solver (vision)

`flash-lite` is the fastest/cheapest Gemini tier and the weakest on nuanced reasoning, which is why maths answers occasionally slip.

## Proposed model split

Two tiers, picked per workload:

| Workload | New model | Why |
|---|---|---|
| Tutor chat (`askTutor`) | `google/gemini-2.5-pro` | Hardest reasoning, accuracy matters most |
| Step-by-step solver (`solveStepByStep`) | `google/gemini-2.5-pro` | Multi-step maths, must be right |
| Photo solver (`solveFromImage`) | `google/gemini-2.5-pro` | Vision + reasoning combined |
| Misconception clustering (`summarizeMisconceptions`) | `google/gemini-2.5-pro` | Pattern reasoning across many mistakes |
| Quiz generation (`generateQuiz`) | `google/gemini-2.5-flash` | Bulk structured output; flash is fast and far more accurate than lite |
| Worksheet generation (`generateWorksheet`) | `google/gemini-2.5-flash` | Parallel per-chapter calls already; flash keeps it snappy |

Result: tutoring becomes the most accurate tier available on the gateway; quiz/worksheet generation gets a quality bump over lite while staying fast (worksheets already fan out per chapter in parallel, so wall-clock stays similar).

## Implementation

Single file: `src/lib/quiz.functions.ts`

1. Replace the single `MODEL` constant with two:
   ```ts
   const MODEL_REASONING = "google/gemini-2.5-pro";   // accuracy-critical
   const MODEL_FAST = "google/gemini-2.5-flash";      // bulk generation
   ```
2. Extend `callAI` / `callAIText` to accept an optional `model` arg (default `MODEL_FAST`).
3. Pass `MODEL_REASONING` from `askTutor`, `solveStepByStep`, `solveFromImage`, `summarizeMisconceptions`.
4. Leave `generateQuiz` / `generateWorksheet` on `MODEL_FAST`.
5. No UI / route / schema changes.

## Trade-offs to be aware of

- `gemini-2.5-pro` is slower and more expensive per call than lite — tutor responses will take a bit longer, but be noticeably more reliable. Quiz/worksheet generation cost rises modestly (flash vs lite) but stays well within typical free usage.
- If you'd rather use OpenAI's `gpt-5` for tutoring instead of Gemini Pro, that's a one-line swap — say the word and I'll use that instead.

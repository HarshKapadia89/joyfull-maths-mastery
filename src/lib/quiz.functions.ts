import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const QuestionTypeEnum = z.enum(["mcq", "fill_blank", "true_false", "short_answer"]);

const QuestionSchema = z.object({
  type: QuestionTypeEnum,
  prompt: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.string(),
  explanation: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

export type QuizQuestion = z.infer<typeof QuestionSchema>;

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
// Accuracy-critical workloads (tutor chat, solver, photo solve, misconception analysis).
const MODEL_REASONING = "google/gemini-2.5-pro";
// Bulk structured generation (quizzes, worksheets, variants) — fast + accurate.
const MODEL_FAST = "google/gemini-2.5-flash";
const MODEL = MODEL_FAST;

async function callAI(opts: {
  systemPrompt: string;
  userPrompt: string;
  toolName: string;
  parameters: Record<string, unknown>;
  model?: string;
}) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const body = {
    model: opts.model ?? MODEL,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: opts.toolName,
          description: "Return the structured payload.",
          parameters: opts.parameters,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: opts.toolName } },
  };

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limit reached. Please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Settings.");
    const t = await res.text();
    console.error("AI gateway error", res.status, t);
    throw new Error(`AI error (${res.status})`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no tool call");
  return JSON.parse(args);
}

async function callAIText(systemPrompt: string, userPrompt: string, model?: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model ?? MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limit reached. Please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Settings.");
    throw new Error(`AI error (${res.status})`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

const questionsToolParams = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["mcq"] },
          prompt: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
            minItems: 4,
            maxItems: 4,
          },
          answer: { type: "string" },
          explanation: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        },
        required: ["type", "prompt", "options", "answer", "explanation", "difficulty"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

function buildMcqSystemPrompt(
  count: number,
  grade: number,
  chapterTitle: string,
  difficulty: "easy" | "medium" | "hard" | "mixed" = "mixed",
) {
  const diffLine =
    difficulty === "mixed"
      ? "- Vary difficulty: mix easy / medium / hard."
      : `- Target difficulty: ${difficulty}. Most questions should be ${difficulty}.`;
  return `You are an expert NCERT (India) Mathematics teacher of tuition-class quality. Generate ${count} original MCQ practice questions for Grade ${grade}, chapter "${chapterTitle}".

Rules:
- ALL questions must be MCQ (multiple choice) with exactly 4 options.
- "answer" MUST exactly match one of the 4 option strings.
${diffLine}
- Strictly within NCERT Grade ${grade} scope for this chapter.
- Aim for a Bloom's taxonomy mix: ~30% recall/understanding, ~40% application, ~30% HOTS (analysis / reasoning / word problems). NCERT-exemplar-style for higher grades.
- "explanation" is a 2–4 sentence solution that shows the METHOD (not just the answer), so a student learns from it.
- Plain text math only (e.g. "3/4", "x^2", "π", "√2"). No LaTeX, no markdown.
- Each question must be unambiguous and age-appropriate.
- Set "type" to "mcq" for every question.`;
}

async function generateMcqBatch(
  grade: number,
  chapterTitle: string,
  count: number,
  difficulty: "easy" | "medium" | "hard" | "mixed" = "mixed",
) {
  const parsed = await callAI({
    systemPrompt: buildMcqSystemPrompt(count, grade, chapterTitle, difficulty),
    userPrompt: `Generate ${count} MCQs for Grade ${grade} – ${chapterTitle}.`,
    toolName: "return_questions",
    parameters: questionsToolParams,
  });
  const validated = z.object({ questions: z.array(QuestionSchema).min(1) }).parse(parsed);
  return validated.questions
    .filter((q) => q.options && q.options.length === 4 && q.options.includes(q.answer))
    .map((q) => ({ ...q, type: "mcq" as const }));
}

export const generateChapterQuiz = createServerFn({ method: "POST" })
  .inputValidator((data: {
    grade: number;
    chapterTitle: string;
    count?: number;
    difficulty?: "easy" | "medium" | "hard" | "mixed";
  }) =>
    z
      .object({
        grade: z.number().int().min(1).max(10),
        chapterTitle: z.string().min(1).max(200),
        count: z.number().int().min(1).max(40).optional(),
        difficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const count = data.count ?? 25;
    const difficulty = data.difficulty ?? "mixed";
    const half = Math.ceil(count / 2);
    const rest = count - half;
    const [a, b] = await Promise.all([
      generateMcqBatch(data.grade, data.chapterTitle, half, difficulty),
      rest > 0
        ? generateMcqBatch(data.grade, data.chapterTitle, rest, difficulty)
        : Promise.resolve([]),
    ]);
    const questions = [...a, ...b].slice(0, count);
    if (questions.length === 0) throw new Error("Failed to generate questions");
    return { questions };
  });

export const generateDailyChallenge = createServerFn({ method: "POST" })
  .inputValidator((data: { seed?: string }) => z.object({ seed: z.string().max(64).optional() }).parse(data))
  .handler(async ({ data }) => {
    const seed = data.seed ?? new Date().toISOString().slice(0, 10);
    const systemPrompt = `You are an NCERT Maths teacher. Generate a "Daily Challenge" of 5 MCQ questions spanning grades 5-10 NCERT topics. ALL questions must be MCQ with exactly 4 options; "answer" must match one option string exactly. Plain text math, no LaTeX. Each needs concise explanation + difficulty. Set "type" to "mcq".`;
    const userPrompt = `Daily seed: ${seed}. Generate 5 fresh MCQs.`;
    const parsed = await callAI({
      systemPrompt,
      userPrompt,
      toolName: "return_questions",
      parameters: questionsToolParams,
    });
    const validated = z.object({ questions: z.array(QuestionSchema).min(1) }).parse(parsed);
    return {
      questions: validated.questions
        .filter((q) => q.options && q.options.length === 4 && q.options.includes(q.answer))
        .map((q) => ({ ...q, type: "mcq" as const })),
    };
  });

export const askTutor = createServerFn({ method: "POST" })
  .inputValidator((data: { question: string; grade?: number; chapterTitle?: string; studentLevel?: "beginner" | "developing" | "proficient" }) =>
    z.object({
      question: z.string().min(1).max(2000),
      grade: z.number().int().min(1).max(10).optional(),
      chapterTitle: z.string().max(200).optional(),
      studentLevel: z.enum(["beginner", "developing", "proficient"]).optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const ctx = data.chapterTitle ? ` currently working on the chapter "${data.chapterTitle}"` : "";
    const levelLine = data.studentLevel === "beginner"
      ? "The student is still building basics — explain prerequisites first, go slow, more analogies."
      : data.studentLevel === "proficient"
      ? "The student is strong — include a harder variation or competitive-exam-style extension at the end."
      : "Pitch at typical school-classroom level.";
    const systemPrompt = `You are "HBK Mathy", a top-tier NCERT Mathematics tutor (think best private tuition teacher) for school students${
      data.grade ? ` of Grade ${data.grade}` : ""
    }${ctx}. ${levelLine}

Teach like a real tuition class. When the student's question is conceptual, follow this structure (plain text, no LaTeX, no markdown headings):
1) Quick intuition — why this concept exists / a real-life analogy (1–2 lines).
2) The idea / definition stated cleanly.
3) Derivation or "why it works" — for Grades 8–10 give a short proper derivation; for Grades 1–7 give visual / story reasoning.
4) One fully worked example with numbered steps.
5) Common mistake students make here (1 line).
6) Check-for-understanding: ask ONE short question back to the student (do not answer it).

When the question is just a problem to solve, give clean numbered steps and a boxed final answer line, then add a 1-line "Why this method" note.

Plain text math only (e.g. "x^2", "π", "√2", "3/4"). Be accurate, age-appropriate, encouraging.`;
    const answer = await callAIText(systemPrompt, data.question, MODEL_REASONING);
    return { answer };
  });

// ---------- NEW: Explain my mistake ----------
export const explainMistake = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      grade: number;
      chapterTitle?: string;
      prompt: string;
      studentAnswer: string;
      correctAnswer: string;
    }) =>
      z
        .object({
          grade: z.number().int().min(1).max(10),
          chapterTitle: z.string().max(200).optional(),
          prompt: z.string().min(1).max(1000),
          studentAnswer: z.string().max(500),
          correctAnswer: z.string().max(500),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const systemPrompt = `You are "HBK Mathy", a kind NCERT Maths tutor for a Grade ${data.grade} student${
      data.chapterTitle ? ` studying "${data.chapterTitle}"` : ""
    }. A student got a question wrong. Reply in this exact structure using plain text (no LaTeX, no markdown headings):

Why your answer is off: <1-2 friendly sentences about the likely misconception>
Correct method:
1. <step>
2. <step>
3. <step>
Final answer: <the correct answer>
Try this next: <one short similar practice question, no answer>

Be encouraging. Age-appropriate language for Grade ${data.grade}.`;
    const userPrompt = `Question: ${data.prompt}\nMy answer: ${data.studentAnswer || "(blank)"}\nCorrect answer: ${data.correctAnswer}\n\nAfter the standard structure, also add a final line:\nPrerequisite to revise: <name of the earlier concept/topic the student should brush up on>`;
    const explanation = await callAIText(systemPrompt, userPrompt);
    return { explanation };
  });

// ---------- NEW: Variant questions for mistake revision ----------
export const regenerateVariants = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { grade: number; basis: { prompt: string; answer: string; type: string }[] }) =>
      z
        .object({
          grade: z.number().int().min(1).max(10),
          basis: z
            .array(
              z.object({
                prompt: z.string().max(1000),
                answer: z.string().max(500),
                type: z.string().max(40),
              }),
            )
            .min(1)
            .max(15),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const systemPrompt = `You are an NCERT Grade ${data.grade} Maths teacher. For each "original" question I give you, produce ONE NEW MCQ variant that tests the SAME concept but with different numbers/wording (not a copy). ALL outputs must be MCQ with exactly 4 options; "answer" must match one option exactly. Plain text math, no LaTeX. One concise explanation each. Set "type" to "mcq".`;
    const userPrompt = `Originals:\n${data.basis
      .map((b, i) => `${i + 1}. ${b.prompt}  (answer: ${b.answer})`)
      .join("\n")}\n\nReturn exactly ${data.basis.length} MCQ variants in the same order.`;
    const parsed = await callAI({
      systemPrompt,
      userPrompt,
      toolName: "return_questions",
      parameters: questionsToolParams,
    });
    const validated = z.object({ questions: z.array(QuestionSchema).min(1) }).parse(parsed);
    return {
      questions: validated.questions
        .filter((q) => q.options && q.options.length === 4 && q.options.includes(q.answer))
        .map((q) => ({ ...q, type: "mcq" as const })),
    };
  });

// ---------- Concept cards (expanded) ----------
const ConceptCardSchema = z.object({
  title: z.string(),
  keyIdea: z.string(),
  example: z.string(),
  pitfall: z.string(),
  examTip: z.string().optional(),
  derivation: z.string().optional(),
  prerequisites: z.string().optional(),
  relatedTopics: z.string().optional(),
});
export type ConceptCard = z.infer<typeof ConceptCardSchema>;

export const generateConceptCards = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { grade: number; chapterTitle: string; depth?: "quick" | "deep" }) =>
      z
        .object({
          grade: z.number().int().min(1).max(10),
          chapterTitle: z.string().min(1).max(200),
          depth: z.enum(["quick", "deep"]).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const depth = data.depth ?? "quick";
    const target = depth === "deep" ? 8 : 4;
    const systemPrompt = `You are a top-tier NCERT Grade ${data.grade} Maths teacher (tuition-class quality). Create exactly ${target} concise "concept cards" that recap the chapter "${data.chapterTitle}" so a student can revise${depth === "deep" ? " thoroughly" : " in 1 minute"} before practice.

Cover a VARIETY of angles across the cards: definition, key formula or rule, a fully worked example, a common mistake / pitfall, an exam tip, and any sub-topic the NCERT chapter is famous for.

Rules:
- Use plain text math (e.g. "3/4", "x^2", "π", "√2"). No LaTeX, no markdown.
- Each field: 1–2 short sentences, age-appropriate for Grade ${data.grade}.
- "title" is a short topic label (3–5 words).
- "examTip" is a 1-line exam-day tip.
- "derivation" (optional) — for Grades 8–10, include a brief proof / derivation in 1–3 lines when the card has a formula or theorem. For Grades 1–7, use a "Why it works" visual/intuition line instead. Omit if not applicable.
- "prerequisites" (optional) — 1 line naming the earlier concept the student should already know.
- "relatedTopics" (optional) — 1 line listing related topics in this or earlier chapters.
- You MUST return ${target} cards in the "cards" array.`;
    const userPrompt = `Make ${target} varied, tuition-class-depth concept cards for Grade ${data.grade} – ${data.chapterTitle}.`;
    const schema = z.object({ cards: z.array(ConceptCardSchema).min(1).max(10) });
    const params = {
      type: "object",
      properties: {
        cards: {
          type: "array",
          minItems: Math.max(2, target - 2),
          maxItems: target + 2,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              keyIdea: { type: "string" },
              example: { type: "string" },
              pitfall: { type: "string" },
              examTip: { type: "string" },
              derivation: { type: "string" },
              prerequisites: { type: "string" },
              relatedTopics: { type: "string" },
            },
            required: ["title", "keyIdea", "example", "pitfall", "examTip"],
            additionalProperties: false,
          },
        },
      },
      required: ["cards"],
      additionalProperties: false,
    };

    let lastErr: unknown;
    for (let i = 0; i < 2; i++) {
      try {
        const parsed = await callAI({
          systemPrompt,
          userPrompt,
          toolName: "return_cards",
          parameters: params,
        });
        const validated = schema.parse(parsed);
        return { cards: validated.cards };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Failed to generate concept cards");
  });

// ---------- Formula sheet ----------
const FormulaSchema = z.object({
  name: z.string(),
  formula: z.string(),
  whenToUse: z.string(),
  derivation: z.string().optional(),
  conditions: z.string().optional(),
  commonMistake: z.string().optional(),
  relatedFormula: z.string().optional(),
});
export type Formula = z.infer<typeof FormulaSchema>;

export const generateFormulaSheet = createServerFn({ method: "POST" })
  .inputValidator((data: { grade: number; chapterTitle: string }) =>
    z
      .object({
        grade: z.number().int().min(1).max(10),
        chapterTitle: z.string().min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const systemPrompt = `You are a top NCERT Grade ${data.grade} Maths teacher. List every important formula, rule, identity, or property a student needs from the chapter "${data.chapterTitle}", with tuition-class-grade depth.

Rules:
- Plain text math only ("a^2 + b^2 = c^2", "π", "√2", "x/y"). No LaTeX, no markdown.
- "name" — short label (e.g. "Area of triangle").
- "formula" — the formula itself.
- "whenToUse" — 1-line description of when to use it.
- "derivation" (optional) — 1–3 line derivation or "why it works"; for Grades 8–10 give a proper short proof, for Grades 1–7 give visual intuition. Omit if trivial.
- "conditions" (optional) — when the formula is valid / not valid (e.g. "a > 0", "x ≠ 0").
- "commonMistake" (optional) — 1-line mistake students typically make.
- "relatedFormula" (optional) — name of a closely related formula.
- Return 4–10 entries, ordered from most fundamental to most advanced.
- If the chapter has very few formulas (definitions-heavy), include key properties / rules instead.`;
    const userPrompt = `Tuition-class formula sheet for Grade ${data.grade} – ${data.chapterTitle}.`;
    const schema = z.object({ formulas: z.array(FormulaSchema).min(1).max(15) });
    const params = {
      type: "object",
      properties: {
        formulas: {
          type: "array",
          minItems: 3,
          maxItems: 12,
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              formula: { type: "string" },
              whenToUse: { type: "string" },
              derivation: { type: "string" },
              conditions: { type: "string" },
              commonMistake: { type: "string" },
              relatedFormula: { type: "string" },
            },
            required: ["name", "formula", "whenToUse"],
            additionalProperties: false,
          },
        },
      },
      required: ["formulas"],
      additionalProperties: false,
    };

    let lastErr: unknown;
    for (let i = 0; i < 2; i++) {
      try {
        const parsed = await callAI({
          systemPrompt,
          userPrompt,
          toolName: "return_formulas",
          parameters: params,
        });
        const validated = schema.parse(parsed);
        return { formulas: validated.formulas };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Failed to generate formula sheet");
  });


// ---------- NEW: Step-by-step solver ----------
const SolutionSchema = z.object({
  steps: z.array(z.string()).min(1).max(15),
  finalAnswer: z.string(),
});
export type Solution = z.infer<typeof SolutionSchema>;

export const solveStepByStep = createServerFn({ method: "POST" })
  .inputValidator((data: { problem: string; grade?: number }) =>
    z
      .object({
        problem: z.string().min(1).max(2000),
        grade: z.number().int().min(1).max(10).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const systemPrompt = `You are "HBK Mathy", an NCERT Maths tutor${
      data.grade ? ` (Grade ${data.grade})` : ""
    }. Solve the student's problem with clear, numbered steps. Each step is one short sentence. Use plain text math (no LaTeX, no markdown). End with the final answer.`;
    const parsed = await callAI({
      systemPrompt,
      userPrompt: data.problem,
      toolName: "return_solution",
      parameters: {
        type: "object",
        properties: {
          steps: { type: "array", items: { type: "string" } },
          finalAnswer: { type: "string" },
        },
        required: ["steps", "finalAnswer"],
        additionalProperties: false,
      },
      model: MODEL_REASONING,
    });
    return SolutionSchema.parse(parsed);
  });

// ---------- NEW: Twin questions (same concept, fresh numbers) ----------
export const generateTwins = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { grade: number; chapterTitle?: string; basis: { prompt: string; answer: string }; count?: number }) =>
      z
        .object({
          grade: z.number().int().min(1).max(10),
          chapterTitle: z.string().max(200).optional(),
          basis: z.object({ prompt: z.string().max(1000), answer: z.string().max(500) }),
          count: z.number().int().min(1).max(5).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const n = data.count ?? 3;
    const systemPrompt = `You are an NCERT Grade ${data.grade} Maths teacher${
      data.chapterTitle ? ` (chapter: "${data.chapterTitle}")` : ""
    }. Create ${n} TWIN MCQs testing the SAME concept as the original but with different numbers/wording. Each MCQ: exactly 4 options, "answer" matches one option exactly, plain text math, no LaTeX. Slightly vary difficulty. Set "type" to "mcq".`;
    const userPrompt = `Original question: ${data.basis.prompt}\nOriginal answer: ${data.basis.answer}\nReturn ${n} twin MCQs.`;
    const parsed = await callAI({
      systemPrompt,
      userPrompt,
      toolName: "return_questions",
      parameters: questionsToolParams,
    });
    const validated = z.object({ questions: z.array(QuestionSchema).min(1) }).parse(parsed);
    return {
      questions: validated.questions
        .filter((q) => q.options && q.options.length === 4 && q.options.includes(q.answer))
        .map((q) => ({ ...q, type: "mcq" as const })),
    };
  });

// ---------- NEW: Worksheet (printable open-ended) ----------
const WorksheetItemSchema = z.object({
  question: z.string(),
  marks: z.number().int().min(1).max(10),
  solution: z.string(),
});
export type WorksheetItem = z.infer<typeof WorksheetItemSchema>;

export const generateWorksheet = createServerFn({ method: "POST" })
  .inputValidator((data: { grade: number; chapterTitles: string[]; totalMarks?: number }) =>
    z
      .object({
        grade: z.number().int().min(1).max(10),
        chapterTitles: z.array(z.string().min(1).max(200)).min(1).max(15),
        totalMarks: z.number().int().min(5).max(100).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const totalMarks = data.totalMarks ?? 30;
    // Aim for ~3 marks/question on average; bound to a sane range.
    const targetQuestions = Math.max(4, Math.min(40, Math.round(totalMarks / 3)));

    const worksheetParams = {
      type: "object",
      properties: {
        items: {
          type: "array",
          minItems: 3,
          maxItems: 40,
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              marks: { type: "number" },
              solution: { type: "string" },
            },
            required: ["question", "marks", "solution"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    };

    async function generateForChapter(chapterTitle: string, qCount: number, marksBudget: number) {
      const systemPrompt = `You are a top NCERT Grade ${data.grade} Maths teacher of tuition-class quality. Create a printable worksheet of approximately ${qCount} OPEN-ENDED (NOT MCQ) practice questions for "${chapterTitle}". Difficulty rises from easy to hard. Each question carries marks between 1 and 5. The marks of all questions MUST sum to exactly ${marksBudget}. Include a model solution (3-6 lines) that shows the method. 5-mark questions should be Board-exam-style case studies or multi-part HOTS questions (label sub-parts (a), (b), (c)). 1–2 mark questions test recall/direct application. Plain text math, no LaTeX, no markdown.`;
      const userPrompt = `Worksheet for Grade ${data.grade} – ${chapterTitle}. About ${qCount} questions totalling exactly ${marksBudget} marks.`;
      const parsed = await callAI({
        systemPrompt,
        userPrompt,
        toolName: "return_worksheet",
        parameters: worksheetParams,
      });
      const validated = z.object({ items: z.array(WorksheetItemSchema).min(1) }).parse(parsed);
      return validated.items;
    }

    // Distribute marks across chapters (last chapter absorbs the remainder).
    const n = data.chapterTitles.length;
    const perMarks = Math.floor(totalMarks / n);
    const perQuestions = Math.max(2, Math.round(targetQuestions / n));
    const batches = await Promise.all(
      data.chapterTitles.map((title, i) => {
        const m = i === n - 1 ? totalMarks - perMarks * (n - 1) : perMarks;
        return generateForChapter(title, perQuestions, m);
      }),
    );

    // Enforce the exact total: greedily accumulate, then patch the last item if needed.
    const pool = batches.flat();
    const out: typeof pool = [];
    let sum = 0;
    for (const it of pool) {
      const m = Math.max(1, Math.min(5, Math.round(it.marks)));
      if (sum + m > totalMarks) continue;
      out.push({ ...it, marks: m });
      sum += m;
      if (sum >= totalMarks) break;
    }
    if (out.length === 0) throw new Error("Failed to generate worksheet items");

    if (sum < totalMarks) {
      // Top up by adding remaining unused items where they fit.
      const used = new Set(out);
      for (const it of pool) {
        if (sum >= totalMarks) break;
        if (used.has(it)) continue;
        const remaining = totalMarks - sum;
        const m = Math.max(1, Math.min(remaining, Math.min(5, Math.round(it.marks))));
        out.push({ ...it, marks: m });
        sum += m;
      }
    }
    if (sum !== totalMarks) {
      // Final patch — adjust the last item's marks (1–10) to close any remaining gap.
      const last = out[out.length - 1];
      const newMarks = Math.max(1, Math.min(10, last.marks + (totalMarks - sum)));
      out[out.length - 1] = { ...last, marks: newMarks };
    }

    return { items: out };
  });

// ---------- NEW: Solve from image (vision doubt-solver) ----------
export const solveFromImage = createServerFn({ method: "POST" })
  .inputValidator((data: { imageDataUrl: string; grade?: number; note?: string }) =>
    z
      .object({
        imageDataUrl: z
          .string()
          .min(20)
          .max(8_000_000)
          .refine((s) => s.startsWith("data:image/"), "Must be an image data URL"),
        grade: z.number().int().min(1).max(10).optional(),
        note: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
    const system = `You are "HBK Mathy", a friendly NCERT Maths tutor${
      data.grade ? ` (Grade ${data.grade})` : ""
    }. The student uploaded a photo of a maths problem. Read it carefully, then solve with clear numbered steps using plain text math (no LaTeX, no markdown). End with "Final answer: ...". If the image is unreadable, ask the student to retake the photo.`;
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_REASONING,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: data.note?.trim() || "Please solve this problem step-by-step." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a minute.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Settings.");
      throw new Error(`AI error (${res.status})`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { answer: json.choices?.[0]?.message?.content ?? "" };
  });

// ---------- NEW: Misconception clusters from the mistake bank ----------
const MisconceptionSchema = z.object({
  title: z.string(),
  why: z.string(),
  fix: z.string(),
  practiceTip: z.string(),
});
export type Misconception = z.infer<typeof MisconceptionSchema>;

export const summarizeMisconceptions = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      grade: number;
      mistakes: { prompt: string; studentAnswer: string; correctAnswer: string; chapterTitle: string }[];
    }) =>
      z
        .object({
          grade: z.number().int().min(1).max(10),
          mistakes: z
            .array(
              z.object({
                prompt: z.string().max(800),
                studentAnswer: z.string().max(300),
                correctAnswer: z.string().max(300),
                chapterTitle: z.string().max(200),
              }),
            )
            .min(1)
            .max(40),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const systemPrompt = `You are an NCERT Grade ${data.grade} Maths teacher. Look at this student's recent wrong answers and find 3-6 RECURRING misconceptions or skill gaps. For each: a short title, why students do it (1 sentence), how to fix it (1-2 sentences), one short practice tip. Plain text math only.`;
    const userPrompt = `Recent mistakes:\n${data.mistakes
      .slice(0, 30)
      .map(
        (m, i) =>
          `${i + 1}. [${m.chapterTitle}] ${m.prompt}\n   student: ${m.studentAnswer || "(blank)"} | correct: ${m.correctAnswer}`,
      )
      .join("\n")}`;
    const params = {
      type: "object",
      properties: {
        clusters: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              why: { type: "string" },
              fix: { type: "string" },
              practiceTip: { type: "string" },
            },
            required: ["title", "why", "fix", "practiceTip"],
            additionalProperties: false,
          },
        },
      },
      required: ["clusters"],
      additionalProperties: false,
    };
    const parsed = await callAI({
      systemPrompt,
      userPrompt,
      toolName: "return_clusters",
      parameters: params,
      model: MODEL_REASONING,
    });
    const validated = z.object({ clusters: z.array(MisconceptionSchema).min(1) }).parse(parsed);
    return { clusters: validated.clusters };
  });

// ============================================================
// DEEP LEARNING (tuition-class) — additive, no removals
// ============================================================

// ---------- Chapter learning pathway (topic roadmap) ----------
const PathwayTopicSchema = z.object({
  title: z.string(),
  oneLiner: z.string(),
});
export type PathwayTopic = z.infer<typeof PathwayTopicSchema>;

export const generateChapterPathway = createServerFn({ method: "POST" })
  .inputValidator((data: { grade: number; chapterTitle: string }) =>
    z.object({
      grade: z.number().int().min(1).max(10),
      chapterTitle: z.string().min(1).max(200),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const systemPrompt = `You are a senior NCERT Grade ${data.grade} Maths teacher planning a tuition-class study pathway for the chapter "${data.chapterTitle}".
Break the chapter into an ORDERED list of 5–9 atomic topics/sub-concepts, the way a real teacher would pace it across multiple sittings — easiest foundations first, applications/word problems last. Each topic gets a 1-line description of what the student will learn there. Plain text only, no LaTeX, no markdown.`;
    const params = {
      type: "object",
      properties: {
        topics: {
          type: "array",
          minItems: 4,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              oneLiner: { type: "string" },
            },
            required: ["title", "oneLiner"],
            additionalProperties: false,
          },
        },
      },
      required: ["topics"],
      additionalProperties: false,
    };
    const parsed = await callAI({
      systemPrompt,
      userPrompt: `Build the ordered learning pathway for Grade ${data.grade} – ${data.chapterTitle}.`,
      toolName: "return_pathway",
      parameters: params,
      model: MODEL_REASONING,
    });
    const validated = z.object({ topics: z.array(PathwayTopicSchema).min(1) }).parse(parsed);
    return { topics: validated.topics };
  });

// ---------- Topic mini-lesson ----------
const TopicLessonSchema = z.object({
  prerequisites: z.string().optional(),
  intuition: z.string(),
  definition: z.string(),
  derivation: z.string().optional(),
  workedExamples: z.array(z.object({
    problem: z.string(),
    steps: z.array(z.string()).min(1).max(10),
    finalAnswer: z.string(),
  })).min(1).max(4),
  commonMistakes: z.array(z.string()).min(1).max(4),
  practiceCheck: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).min(1).max(3),
  whatsNext: z.string().optional(),
});
export type TopicLesson = z.infer<typeof TopicLessonSchema>;

export const generateTopicLesson = createServerFn({ method: "POST" })
  .inputValidator((data: { grade: number; chapterTitle: string; topicTitle: string; nextTopicTitle?: string }) =>
    z.object({
      grade: z.number().int().min(1).max(10),
      chapterTitle: z.string().min(1).max(200),
      topicTitle: z.string().min(1).max(200),
      nextTopicTitle: z.string().max(200).optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const isUpper = data.grade >= 8;
    const derivationLine = isUpper
      ? `"derivation" — a proper short proof / derivation in 2–5 lines when applicable. Omit if this topic is purely definitional.`
      : `"derivation" — a "why it works" visual / story explanation in 2–4 lines. No formal algebra.`;
    const systemPrompt = `You are the best NCERT Grade ${data.grade} Maths tuition teacher. Teach the topic "${data.topicTitle}" from the chapter "${data.chapterTitle}" the way you would in a 1-on-1 class. Tuition-class depth, age-appropriate for Grade ${data.grade}. Plain text math only ("x^2", "π", "√2"). No LaTeX, no markdown.

Fields:
- "prerequisites" — 1 line naming the earlier concept the student should know.
- "intuition" — 1–3 lines: why this concept exists / a real-life analogy.
- "definition" — the formal definition or statement, clean.
- ${derivationLine}
- "workedExamples" — 2 to 3 fully worked examples, graded easy → hard, each with numbered steps and final answer.
- "commonMistakes" — 2 to 3 specific mistakes students actually make on THIS topic.
- "practiceCheck" — 2 short self-check questions with their answers.
- "whatsNext" — 1 line pointing to ${data.nextTopicTitle ? `the next topic ("${data.nextTopicTitle}")` : "what to study next"}.`;
    const params = {
      type: "object",
      properties: {
        prerequisites: { type: "string" },
        intuition: { type: "string" },
        definition: { type: "string" },
        derivation: { type: "string" },
        workedExamples: {
          type: "array",
          minItems: 1, maxItems: 4,
          items: {
            type: "object",
            properties: {
              problem: { type: "string" },
              steps: { type: "array", items: { type: "string" } },
              finalAnswer: { type: "string" },
            },
            required: ["problem", "steps", "finalAnswer"],
            additionalProperties: false,
          },
        },
        commonMistakes: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
        practiceCheck: {
          type: "array",
          minItems: 1, maxItems: 3,
          items: {
            type: "object",
            properties: { question: { type: "string" }, answer: { type: "string" } },
            required: ["question", "answer"],
            additionalProperties: false,
          },
        },
        whatsNext: { type: "string" },
      },
      required: ["intuition", "definition", "workedExamples", "commonMistakes", "practiceCheck"],
      additionalProperties: false,
    };
    const parsed = await callAI({
      systemPrompt,
      userPrompt: `Teach "${data.topicTitle}" (chapter: ${data.chapterTitle}) for Grade ${data.grade}.`,
      toolName: "return_lesson",
      parameters: params,
      model: MODEL_REASONING,
    });
    return TopicLessonSchema.parse(parsed);
  });

// ---------- Solved Examples (NCERT-textbook style) ----------
const SolvedExampleSchema = z.object({
  title: z.string(),
  given: z.string(),
  toFind: z.string(),
  method: z.string(),
  steps: z.array(z.string()).min(1).max(12),
  finalAnswer: z.string(),
  alternateMethod: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]),
});
export type SolvedExample = z.infer<typeof SolvedExampleSchema>;

export const generateSolvedExamples = createServerFn({ method: "POST" })
  .inputValidator((data: { grade: number; chapterTitle: string; count?: number }) =>
    z.object({
      grade: z.number().int().min(1).max(10),
      chapterTitle: z.string().min(1).max(200),
      count: z.number().int().min(4).max(12).optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const count = data.count ?? 8;
    const systemPrompt = `You are a senior NCERT Grade ${data.grade} Maths teacher. Produce ${count} solved examples for the chapter "${data.chapterTitle}", in classic NCERT-textbook style. Grade them easy → medium → hard. For each: a short title, "Given", "To find / prove", a 1-line note on which Method/approach you'll use and why, then numbered solution steps, a clearly stated final answer, and OPTIONALLY a brief alternate method when one exists. Plain text math only. No LaTeX, no markdown.`;
    const params = {
      type: "object",
      properties: {
        examples: {
          type: "array",
          minItems: 4, maxItems: 12,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              given: { type: "string" },
              toFind: { type: "string" },
              method: { type: "string" },
              steps: { type: "array", items: { type: "string" } },
              finalAnswer: { type: "string" },
              alternateMethod: { type: "string" },
              difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            },
            required: ["title", "given", "toFind", "method", "steps", "finalAnswer", "difficulty"],
            additionalProperties: false,
          },
        },
      },
      required: ["examples"],
      additionalProperties: false,
    };
    const parsed = await callAI({
      systemPrompt,
      userPrompt: `${count} graded solved examples for Grade ${data.grade} – ${data.chapterTitle}.`,
      toolName: "return_examples",
      parameters: params,
      model: MODEL_REASONING,
    });
    const validated = z.object({ examples: z.array(SolvedExampleSchema).min(1) }).parse(parsed);
    return { examples: validated.examples };
  });

// ---------- Exam Corner (PYQ-style / Olympiad-style by grade) ----------
const ExamQuestionSchema = z.object({
  question: z.string(),
  marks: z.number().int().min(1).max(6),
  examinerExpects: z.string(),
  modelAnswer: z.string(),
  timeTip: z.string().optional(),
  source: z.string().optional(),
});
export type ExamQuestion = z.infer<typeof ExamQuestionSchema>;

export const generateExamCorner = createServerFn({ method: "POST" })
  .inputValidator((data: { grade: number; chapterTitle: string }) =>
    z.object({
      grade: z.number().int().min(1).max(10),
      chapterTitle: z.string().min(1).max(200),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const isBoard = data.grade >= 9;
    const styleLine = isBoard
      ? `Style: CBSE Board exam / PYQ pattern, including 1-mark, 2-mark, 3-mark and 5-mark case-study/HOTS questions. Mention typical CBSE marking scheme cues in "examinerExpects".`
      : `Style: school unit-test + Olympiad/NTSE-foundation style. Short objective + reasoning questions.`;
    const systemPrompt = `You are an experienced NCERT Grade ${data.grade} Maths teacher who also coaches for exams. Produce 6–8 high-yield exam-style questions for the chapter "${data.chapterTitle}".
${styleLine}
For each: the question, the marks it carries, a 1–2 line "examinerExpects" note (what fetches full marks: which formula to quote, units, diagram, etc.), a clean MODEL answer that would score full marks, and a short time-management tip. If relevant, mention a plausible "source" tag like "CBSE Board pattern", "NTSE-style", or "Olympiad-style". Plain text math only. No LaTeX, no markdown.`;
    const params = {
      type: "object",
      properties: {
        questions: {
          type: "array",
          minItems: 4, maxItems: 10,
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              marks: { type: "number" },
              examinerExpects: { type: "string" },
              modelAnswer: { type: "string" },
              timeTip: { type: "string" },
              source: { type: "string" },
            },
            required: ["question", "marks", "examinerExpects", "modelAnswer"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    };
    const parsed = await callAI({
      systemPrompt,
      userPrompt: `Exam Corner for Grade ${data.grade} – ${data.chapterTitle}.`,
      toolName: "return_exam",
      parameters: params,
      model: MODEL_REASONING,
    });
    const validated = z.object({ questions: z.array(ExamQuestionSchema).min(1) }).parse(parsed);
    return { questions: validated.questions };
  });

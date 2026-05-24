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
  return `You are an expert NCERT (India) Mathematics teacher. Generate ${count} original MCQ practice questions for Grade ${grade}, chapter "${chapterTitle}".

Rules:
- ALL questions must be MCQ (multiple choice) with exactly 4 options.
- "answer" MUST exactly match one of the 4 option strings.
${diffLine}
- Strictly within NCERT Grade ${grade} scope for this chapter.
- "explanation" is a concise 1-sentence solution.
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
  .inputValidator((data: { question: string; grade?: number }) =>
    z.object({ question: z.string().min(1).max(2000), grade: z.number().int().min(1).max(10).optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const systemPrompt = `You are "HBK Mathy", a friendly NCERT Mathematics tutor for school students${
      data.grade ? ` (Grade ${data.grade})` : ""
    }. Explain concepts step-by-step in simple language. Use plain text math (no LaTeX). Keep answers concise but complete. End with one short follow-up tip or question.`;
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
    const userPrompt = `Question: ${data.prompt}\nMy answer: ${data.studentAnswer || "(blank)"}\nCorrect answer: ${data.correctAnswer}`;
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
    const systemPrompt = `You are an NCERT Grade ${data.grade} Maths teacher. Create exactly ${target} concise "concept cards" that recap the chapter "${data.chapterTitle}" so a student can revise${depth === "deep" ? " thoroughly" : " in 1 minute"} before practice.

Cover a VARIETY of angles across the cards: definition, key formula or rule, a fully worked example, a common mistake / pitfall, an exam tip, and any sub-topic the NCERT chapter is famous for.

Rules:
- Use plain text math (e.g. "3/4", "x^2", "π", "√2"). No LaTeX, no markdown.
- Each field: 1–2 short sentences, age-appropriate for Grade ${data.grade}.
- "title" is a short topic label (3–5 words).
- "examTip" is a 1-line exam-day tip.
- You MUST return ${target} cards in the "cards" array.`;
    const userPrompt = `Make ${target} varied concept cards for Grade ${data.grade} – ${data.chapterTitle}.`;
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
    const systemPrompt = `You are an NCERT Grade ${data.grade} Maths teacher. List every important formula, rule, identity, or property a student needs from the chapter "${data.chapterTitle}".

Rules:
- Plain text math only ("a^2 + b^2 = c^2", "π", "√2", "x/y"). No LaTeX, no markdown.
- "name" is a short label (e.g. "Area of triangle").
- "formula" is the formula itself.
- "whenToUse" is a 1-line description of when to use it.
- Return 4–10 entries, ordered from most fundamental to most advanced.
- If the chapter has very few formulas (e.g. a definitions-heavy chapter), include key properties / rules instead.`;
    const userPrompt = `Formula sheet for Grade ${data.grade} – ${data.chapterTitle}.`;
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
      const systemPrompt = `You are an NCERT Grade ${data.grade} Maths teacher. Create a printable worksheet of approximately ${qCount} OPEN-ENDED (NOT MCQ) practice questions for "${chapterTitle}". Difficulty rises from easy to hard. Each question carries marks between 1 and 5. The marks of all questions MUST sum to exactly ${marksBudget}. Include a concise model solution (3-6 lines). Plain text math, no LaTeX, no markdown.`;
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
    });
    const validated = z.object({ clusters: z.array(MisconceptionSchema).min(1) }).parse(parsed);
    return { clusters: validated.clusters };
  });

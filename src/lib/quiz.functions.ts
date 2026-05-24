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
const MODEL = "google/gemini-2.5-flash-lite";

async function callAI(opts: {
  systemPrompt: string;
  userPrompt: string;
  toolName: string;
  parameters: Record<string, unknown>;
}) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const body = {
    model: MODEL,
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

async function callAIText(systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
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
    const answer = await callAIText(systemPrompt, data.question);
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
    });
    return SolutionSchema.parse(parsed);
  });

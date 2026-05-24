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
          type: { type: "string", enum: ["mcq", "fill_blank", "true_false", "short_answer"] },
          prompt: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer: { type: "string" },
          explanation: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        },
        required: ["type", "prompt", "answer", "explanation", "difficulty"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

export const generateChapterQuiz = createServerFn({ method: "POST" })
  .inputValidator((data: { grade: number; chapterTitle: string; count?: number }) =>
    z
      .object({
        grade: z.number().int().min(1).max(10),
        chapterTitle: z.string().min(1).max(200),
        count: z.number().int().min(1).max(40).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const count = data.count ?? 25;
    const systemPrompt = `You are an expert NCERT (India) Mathematics teacher creating practice questions for school students. Generate ${count} original, syllabus-aligned questions for Grade ${data.grade}, chapter "${data.chapterTitle}".

Rules:
- Strictly stay within the chapter's scope and the NCERT Grade ${data.grade} level.
- Mix all 4 formats: MCQ (4 options), fill_blank, true_false, short_answer (numeric or one-word).
- Aim for ~10 MCQ, ~6 fill_blank, ~4 true_false, ~5 short_answer. Vary difficulty (easy/medium/hard).
- For MCQ: exactly 4 options, one correct. "answer" must EXACTLY match one option string.
- For true_false: options must be ["True","False"], answer one of them.
- For fill_blank: write the prompt with a "____" blank; the answer is the missing text.
- For short_answer: keep the answer short (a number or single phrase, max 30 chars).
- "explanation" is a concise 1-2 sentence solution.
- Use plain text math (e.g. "3/4", "x^2", "π", "√2"). No LaTeX, no markdown.
- Questions must be age-appropriate and unambiguous.`;

    const userPrompt = `Generate ${count} questions for Grade ${data.grade} – ${data.chapterTitle}.`;

    const parsed = await callAI({
      systemPrompt,
      userPrompt,
      toolName: "return_questions",
      parameters: questionsToolParams,
    });

    const validated = z.object({ questions: z.array(QuestionSchema).min(1) }).parse(parsed);
    const cleaned = validated.questions.map((q) => {
      if (q.type === "true_false") return { ...q, options: ["True", "False"] };
      return q;
    });
    return { questions: cleaned };
  });

export const generateDailyChallenge = createServerFn({ method: "POST" })
  .inputValidator((data: { seed?: string }) => z.object({ seed: z.string().max(64).optional() }).parse(data))
  .handler(async ({ data }) => {
    const seed = data.seed ?? new Date().toISOString().slice(0, 10);
    const systemPrompt = `You are an NCERT Maths teacher. Generate a "Daily Challenge" of 5 mixed Maths questions spanning grades 5-10 NCERT topics. Mix MCQ, fill_blank, true_false, short_answer. Use plain text math, no LaTeX. Each question needs answer + concise explanation + difficulty.`;
    const userPrompt = `Daily seed: ${seed}. Generate 5 fresh questions.`;
    const parsed = await callAI({
      systemPrompt,
      userPrompt,
      toolName: "return_questions",
      parameters: questionsToolParams,
    });
    const validated = z.object({ questions: z.array(QuestionSchema).min(1) }).parse(parsed);
    return {
      questions: validated.questions.map((q) =>
        q.type === "true_false" ? { ...q, options: ["True", "False"] } : q,
      ),
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
    const systemPrompt = `You are an NCERT Grade ${data.grade} Maths teacher. For each "original" question I give you, produce ONE NEW variant that tests the SAME concept but with different numbers/wording (not a copy). Keep the same type. Follow the same JSON rules as before: MCQ has 4 options with answer matching one; true_false uses options ["True","False"]; plain text math, no LaTeX. One concise explanation each.`;
    const userPrompt = `Originals:\n${data.basis
      .map((b, i) => `${i + 1}. [${b.type}] ${b.prompt}  (answer: ${b.answer})`)
      .join("\n")}\n\nReturn exactly ${data.basis.length} variant questions in the same order.`;
    const parsed = await callAI({
      systemPrompt,
      userPrompt,
      toolName: "return_questions",
      parameters: questionsToolParams,
    });
    const validated = z.object({ questions: z.array(QuestionSchema).min(1) }).parse(parsed);
    return {
      questions: validated.questions.map((q) =>
        q.type === "true_false" ? { ...q, options: ["True", "False"] } : q,
      ),
    };
  });

// ---------- NEW: Concept cards ----------
const ConceptCardSchema = z.object({
  title: z.string(),
  keyIdea: z.string(),
  example: z.string(),
  pitfall: z.string(),
});
export type ConceptCard = z.infer<typeof ConceptCardSchema>;

export const generateConceptCards = createServerFn({ method: "POST" })
  .inputValidator((data: { grade: number; chapterTitle: string }) =>
    z
      .object({
        grade: z.number().int().min(1).max(10),
        chapterTitle: z.string().min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const systemPrompt = `You are an NCERT Grade ${data.grade} Maths teacher. Create 4 concise "concept cards" that recap the chapter "${data.chapterTitle}" so a student can revise in 1 minute before practice. Use plain text math, no LaTeX, no markdown. Keep every field to 1-2 short sentences. Age-appropriate for Grade ${data.grade}.`;
    const userPrompt = `Make 4 concept cards for Grade ${data.grade} – ${data.chapterTitle}.`;
    const parsed = await callAI({
      systemPrompt,
      userPrompt,
      toolName: "return_cards",
      parameters: {
        type: "object",
        properties: {
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                keyIdea: { type: "string" },
                example: { type: "string" },
                pitfall: { type: "string" },
              },
              required: ["title", "keyIdea", "example", "pitfall"],
              additionalProperties: false,
            },
          },
        },
        required: ["cards"],
        additionalProperties: false,
      },
    });
    const validated = z.object({ cards: z.array(ConceptCardSchema).min(1).max(8) }).parse(parsed);
    return { cards: validated.cards };
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

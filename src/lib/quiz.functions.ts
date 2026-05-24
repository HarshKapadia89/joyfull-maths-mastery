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

async function callAI(opts: {
  systemPrompt: string;
  userPrompt: string;
  toolName: string;
  parameters: Record<string, unknown>;
}) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const body = {
    model: "google/gemini-3-flash-preview",
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
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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
    // Defensive: ensure true/false has options, MCQ has 4 options
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
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are "HBK Mathy", a friendly NCERT Mathematics tutor for school students${
      data.grade ? ` (Grade ${data.grade})` : ""
    }. Explain concepts step-by-step in simple language. Use plain text math (no LaTeX). Keep answers concise but complete. End with one short follow-up tip or question.`;

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: data.question },
        ],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a minute.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Settings.");
      throw new Error(`AI error (${res.status})`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    return { answer: content };
  });

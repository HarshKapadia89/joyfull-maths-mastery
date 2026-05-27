import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChapterProgressDTO = {
  best: number;
  total: number;
  stars: number;
  attempts: number;
  correct?: number;
  asked?: number;
};

export type ProfileDTO = {
  id: string;
  full_name: string | null;
  grade: number | null;
  phone: string | null;
  subscription_tier: "free" | "plus" | "pro" | "family";
  subscription_expires_at: string | null;
  xp: number;
  streak: number;
  last_active_date: string | null;
  problem_stars: number;
  concept_stars: number;
  chapters: Record<string, ChapterProgressDTO>;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      // Trigger should have created it, but fall back to an insert.
      const { data: created, error: insErr } = await supabase
        .from("profiles")
        .insert({ id: userId })
        .select("*")
        .single();
      if (insErr) throw new Error(insErr.message);
      return created as unknown as ProfileDTO;
    }
    return data as unknown as ProfileDTO;
  });

const ProfilePatchSchema = z.object({
  full_name: z.string().trim().min(1).max(80).optional(),
  grade: z.number().int().min(1).max(10).optional(),
  phone: z.string().trim().max(20).optional(),
  onboarded: z.boolean().optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfilePatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: updated, error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return updated as unknown as ProfileDTO;
  });

const ChapterSchema = z.object({
  best: z.number().int().min(0),
  total: z.number().int().min(0),
  stars: z.number().int().min(0).max(3),
  attempts: z.number().int().min(0),
  correct: z.number().int().min(0).optional(),
  asked: z.number().int().min(0).optional(),
});

const MergeSchema = z.object({
  xp: z.number().int().min(0).max(10_000_000),
  streak: z.number().int().min(0).max(10_000),
  problem_stars: z.number().int().min(0).max(100_000),
  concept_stars: z.number().int().min(0).max(100_000),
  last_played: z.string().nullable().optional(),
  chapters: z.record(z.string(), ChapterSchema),
});

export const mergeLocalProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MergeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cur, error: readErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (readErr) throw new Error(readErr.message);
    const profile = cur as unknown as ProfileDTO;

    const mergedChapters: Record<string, ChapterProgressDTO> = {
      ...(profile.chapters ?? {}),
    };
    for (const [key, incoming] of Object.entries(data.chapters)) {
      const existing = mergedChapters[key];
      mergedChapters[key] = existing
        ? {
            best: Math.max(existing.best, incoming.best),
            total: Math.max(existing.total, incoming.total),
            stars: Math.max(existing.stars, incoming.stars),
            attempts: Math.max(existing.attempts, incoming.attempts),
            correct: Math.max(existing.correct ?? 0, incoming.correct ?? 0),
            asked: Math.max(existing.asked ?? 0, incoming.asked ?? 0),
          }
        : incoming;
    }

    const patch = {
      xp: Math.max(profile.xp, data.xp),
      streak: Math.max(profile.streak, data.streak),
      problem_stars: Math.max(profile.problem_stars, data.problem_stars),
      concept_stars: Math.max(profile.concept_stars, data.concept_stars),
      chapters: mergedChapters,
      last_active_date:
        data.last_played && (!profile.last_active_date || data.last_played > profile.last_active_date)
          ? data.last_played
          : profile.last_active_date,
    };

    const { data: updated, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return updated as unknown as ProfileDTO;
  });

const ProgressPatchSchema = z.object({
  xp: z.number().int().min(0).max(10_000_000).optional(),
  streak: z.number().int().min(0).max(10_000).optional(),
  problem_stars: z.number().int().min(0).max(100_000).optional(),
  concept_stars: z.number().int().min(0).max(100_000).optional(),
  last_active_date: z.string().nullable().optional(),
  chapters: z.record(z.string(), ChapterSchema).optional(),
});

export const updateProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProgressPatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: updated, error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return updated as unknown as ProfileDTO;
  });

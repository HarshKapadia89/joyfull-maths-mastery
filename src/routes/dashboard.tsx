import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { HeroBanner } from "@/components/home/HeroBanner";
import { StatTiles } from "@/components/home/StatTiles";
import { ProblemOfTheDay } from "@/components/home/ProblemOfTheDay";
import { ModeCards } from "@/components/home/ModeCards";
import { GradeCard } from "@/components/home/GradeCard";
import { GRADE_THEMES } from "@/data/grade-themes";
import { useProgress } from "@/hooks/useProgress";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCloudProgressSync } from "@/hooks/useCloudProgressSync";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — HBK Maths Quest" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { state } = useProgress();
  useCloudProgressSync();

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) navigate({ to: "/login", search: { redirect: "/dashboard" } });
    });
  }, [navigate]);

  useEffect(() => {
    if (profile && !profile.onboarded) navigate({ to: "/onboarding" });
  }, [profile, navigate]);

  if (loading || !isAuthenticated || profileLoading) {
    return <div className="p-8 text-center">Loading…</div>;
  }

  // Prefer cloud counters when available
  const merged = profile
    ? {
        ...state,
        xp: profile.xp,
        streak: profile.streak,
        totalStars: profile.problem_stars,
        conceptStars: profile.concept_stars,
      }
    : state;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <HeroBanner />
      <StatTiles state={merged} />
      <ProblemOfTheDay streak={merged.streak} />
      <ModeCards />
      <section>
        <h2 className="mb-4 text-2xl font-extrabold">Choose your world</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {GRADE_THEMES.map((t) => (
            <GradeCard key={t.grade} grade={t.grade} progress={merged} />
          ))}
        </div>
      </section>
    </div>
  );
}

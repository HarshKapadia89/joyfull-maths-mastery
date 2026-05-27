import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sparkles, BookOpen, Trophy, Brain } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SignInButton } from "@/components/auth/SignInButton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HBK Maths Quest — Learn NCERT Maths Grades 1-10 the fun way" },
      { name: "description", content: "Play through NCERT Maths chapters for grades 1 to 10. Quizzes, AI tutor, revision packs, and daily challenges." },
      { property: "og:title", content: "HBK Maths Quest" },
      { property: "og:description", content: "Master NCERT Maths grades 1-10 the fun way." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: "/dashboard" });
  }, [loading, isAuthenticated, navigate]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="bg-gradient-hero shadow-glow rounded-3xl p-8 text-white sm:p-14">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-90">For NCERT Maths · Grades 1–10</p>
        <h1 className="mt-2 text-4xl leading-tight font-extrabold sm:text-6xl">
          Master Maths the fun way.
        </h1>
        <p className="mt-4 max-w-2xl text-base opacity-95 sm:text-lg">
          Quizzes, concept cards, AI tutor and revision packs — built for Indian students. Start free, no card needed.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <SignInButton size="lg" label="Continue with Google" />
          <Link
            to="/dashboard"
            className="bg-white/10 hover:bg-white/20 inline-flex items-center rounded-md px-5 py-2.5 text-sm font-semibold backdrop-blur"
          >
            Browse as guest
          </Link>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-4">
        {[
          { icon: BookOpen, title: "All NCERT chapters", body: "Grades 1–10, every chapter." },
          { icon: Brain, title: "AI tutor", body: "Ask Mathy anything, anytime." },
          { icon: Sparkles, title: "Revision packs", body: "Quick gist + full tuition handout PDFs." },
          { icon: Trophy, title: "XP, streaks, stars", body: "Stay motivated daily." },
        ].map((f) => (
          <div key={f.title} className="bg-card shadow-card rounded-2xl p-5">
            <f.icon className="text-primary h-6 w-6" />
            <h3 className="mt-3 font-extrabold">{f.title}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-12 text-center">
        <h2 className="text-2xl font-extrabold">Ready to start?</h2>
        <p className="text-muted-foreground mt-1">Sign in to save your progress across devices.</p>
        <div className="mt-4 flex justify-center gap-3">
          <SignInButton size="lg" />
          <Link to="/pricing" className="bg-secondary hover:bg-secondary/80 inline-flex items-center rounded-md px-5 py-2.5 text-sm font-semibold">
            See pricing
          </Link>
        </div>
      </section>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { HeroBanner } from "@/components/home/HeroBanner";
import { StatTiles } from "@/components/home/StatTiles";
import { ProblemOfTheDay } from "@/components/home/ProblemOfTheDay";
import { ModeCards } from "@/components/home/ModeCards";
import { GradeCard } from "@/components/home/GradeCard";
import { GRADE_THEMES } from "@/data/grade-themes";
import { useProgress } from "@/hooks/useProgress";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HBK Maths Quest — Learn NCERT Maths Grades 1-10 the fun way" },
      { name: "description", content: "Play through NCERT Maths chapters for grades 1 to 10. 25 mixed questions per chapter, daily challenges, and an AI tutor." },
      { property: "og:title", content: "HBK Maths Quest" },
      { property: "og:description", content: "Master NCERT Maths grades 1-10 the fun way." },
    ],
  }),
  component: Home,
});

function Home() {
  const { state } = useProgress();
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <HeroBanner />
      <StatTiles state={state} />
      <ProblemOfTheDay streak={state.streak} />
      <ModeCards />
      <section>
        <h2 className="mb-4 text-2xl font-extrabold">Choose your world</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {GRADE_THEMES.map((t) => (
            <GradeCard key={t.grade} grade={t.grade} progress={state} />
          ))}
        </div>
      </section>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { Lightbulb, Zap } from "lucide-react";

const TIPS = [
  { title: "Order of operations", body: "Remember BODMAS: Brackets, Of, Division, Multiplication, Addition, Subtraction." },
  { title: "Prime numbers", body: "A prime number has exactly two factors: 1 and itself. 2 is the only even prime." },
  { title: "Pi (π)", body: "π ≈ 3.14159… It's the ratio of a circle's circumference to its diameter." },
  { title: "Pythagoras", body: "In a right triangle: a² + b² = c², where c is the hypotenuse." },
  { title: "Fractions", body: "To add fractions, find a common denominator first, then add the numerators." },
  { title: "Place value", body: "In 4,328 the digit 3 means 300 because it sits in the hundreds place." },
  { title: "Percentages", body: "x% of y means (x ÷ 100) × y. So 25% of 80 = 20." },
];

export function ProblemOfTheDay({ streak }: { streak: number }) {
  const today = new Date();
  const idx = today.getDate() % TIPS.length;
  const tip = TIPS[idx];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="bg-card shadow-card flex items-center gap-4 rounded-2xl p-5">
        <div className="bg-primary/15 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
          <Lightbulb className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
            Tip of the Day
          </p>
          <p className="text-foreground truncate text-lg font-bold">{tip.title}</p>
          <p className="text-muted-foreground text-sm">{tip.body}</p>
        </div>
      </div>

      <Link
        to="/daily"
        className="bg-gradient-daily shadow-glow flex items-center gap-4 rounded-2xl p-5 text-white transition hover:brightness-105"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Zap className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase opacity-90">
            Daily Challenge
          </p>
          <p className="text-xl font-extrabold">5 mixed questions · 2× XP</p>
          <p className="text-sm opacity-90">Streak: {streak} day{streak === 1 ? "" : "s"}</p>
        </div>
      </Link>
    </div>
  );
}

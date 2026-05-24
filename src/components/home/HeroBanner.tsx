import { Link } from "@tanstack/react-router";
import mascot from "@/assets/mathy-mascot.png";
import { Trophy } from "lucide-react";

export function HeroBanner() {
  return (
    <section className="bg-gradient-hero shadow-glow relative overflow-hidden rounded-3xl p-6 text-white sm:p-10">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <img
          src={mascot}
          alt="HBK Mathy, your maths mascot"
          width={160}
          height={160}
          className="h-32 w-32 shrink-0 drop-shadow-lg sm:h-40 sm:w-40"
        />
        <div className="flex-1">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-90">
            HBK Maths Quest · with HBK Mathy
          </p>
          <h1 className="mt-1 text-3xl leading-tight font-extrabold sm:text-5xl">
            Learn Maths the fun way
          </h1>
          <p className="mt-3 max-w-2xl text-sm opacity-95 sm:text-base">
            Hi! I'm HBK Mathy. Pick your grade, conquer NCERT chapters one quest at a time, and become a maths champion.
          </p>
        </div>
        <Link
          to="/progress"
          className="bg-warning text-warning-foreground hover:bg-warning/90 inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 font-semibold shadow-lg transition"
        >
          <Trophy className="h-4 w-4" />
          My Progress
        </Link>
      </div>
    </section>
  );
}

import { Star, BookOpen, Sparkles, Flame } from "lucide-react";
import type { ProgressState } from "@/hooks/useProgress";

function Tile({
  icon,
  label,
  value,
  iconBg,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-card shadow-card flex items-center gap-3 rounded-2xl p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <div>
        <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
          {label}
        </p>
        <p className="text-foreground text-2xl font-extrabold">{value}</p>
      </div>
    </div>
  );
}

export function StatTiles({ state }: { state: ProgressState }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile
        label="Problem Stars"
        value={state.totalStars}
        icon={<Star className="h-5 w-5" />}
        iconBg="bg-warning/15"
        iconColor="text-warning"
      />
      <Tile
        label="Concept Stars"
        value={state.conceptStars}
        icon={<BookOpen className="h-5 w-5" />}
        iconBg="bg-primary/15"
        iconColor="text-primary"
      />
      <Tile
        label="XP"
        value={state.xp}
        icon={<Sparkles className="h-5 w-5" />}
        iconBg="bg-primary/15"
        iconColor="text-primary"
      />
      <Tile
        label="Day Streak"
        value={state.streak}
        icon={<Flame className="h-5 w-5" />}
        iconBg="bg-accent"
        iconColor="text-accent-foreground"
      />
    </div>
  );
}

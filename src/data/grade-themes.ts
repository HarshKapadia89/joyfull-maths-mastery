// Visual theme per grade: world name, mascot emoji, and gradient classes.
export type GradeTheme = {
  grade: number;
  world: string;
  emoji: string;
  // Tailwind gradient classes built from raw colors (allowed inside this
  // single themed data file; tokens for the rest of the app live in styles.css).
  gradient: string;
  ring: string;
};

export const GRADE_THEMES: GradeTheme[] = [
  { grade: 1, world: "Counting Cubs", emoji: "🦁", gradient: "from-orange-400 to-rose-500", ring: "ring-orange-300" },
  { grade: 2, world: "Number Reef", emoji: "🐬", gradient: "from-sky-400 to-cyan-500", ring: "ring-sky-300" },
  { grade: 3, world: "Shape Savanna", emoji: "🐘", gradient: "from-amber-400 to-yellow-500", ring: "ring-amber-300" },
  { grade: 4, world: "Fraction Forest", emoji: "🦊", gradient: "from-emerald-400 to-green-600", ring: "ring-emerald-300" },
  { grade: 5, world: "Decimal Drift", emoji: "🐧", gradient: "from-blue-400 to-indigo-500", ring: "ring-blue-300" },
  { grade: 6, world: "Pattern Dunes", emoji: "🐪", gradient: "from-orange-400 to-amber-600", ring: "ring-orange-300" },
  { grade: 7, world: "Expression Heights", emoji: "🦅", gradient: "from-violet-500 to-fuchsia-600", ring: "ring-violet-300" },
  { grade: 8, world: "Algebra Atoll", emoji: "🐯", gradient: "from-teal-400 to-cyan-600", ring: "ring-teal-300" },
  { grade: 9, world: "Geometry Grove", emoji: "🐺", gradient: "from-slate-500 to-indigo-700", ring: "ring-slate-300" },
  { grade: 10, world: "Trigon Cosmos", emoji: "🦉", gradient: "from-fuchsia-500 to-purple-700", ring: "ring-fuchsia-300" },
];

export function getTheme(grade: number): GradeTheme {
  return GRADE_THEMES.find((t) => t.grade === grade) ?? GRADE_THEMES[0];
}

import { Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function UpgradeLockBadge({ tier = "Pro" }: { tier?: "Plus" | "Pro" }) {
  return (
    <Link
      to="/pricing"
      className="bg-warning/15 text-warning hover:bg-warning/25 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition"
    >
      <Lock className="h-3 w-3" />
      {tier}
    </Link>
  );
}

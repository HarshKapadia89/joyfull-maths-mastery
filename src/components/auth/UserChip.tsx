import { Link } from "@tanstack/react-router";
import { Flame, LogOut, Sparkles, User as UserIcon } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { signOut } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const tierStyles: Record<string, string> = {
  free: "bg-secondary text-secondary-foreground",
  plus: "bg-primary/15 text-primary",
  pro: "bg-warning/15 text-warning",
  family: "bg-accent text-accent-foreground",
};

const tierLabel: Record<string, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
  family: "Family",
};

export function UserChip() {
  const { data: profile } = useProfile();
  if (!profile) return null;
  const name = profile.full_name?.split(" ")[0] || "Student";
  const tier = profile.subscription_tier ?? "free";
  return (
    <div className="flex items-center gap-2">
      <span className="text-foreground hidden text-sm font-semibold sm:inline">
        {name}
        {profile.grade ? <span className="text-muted-foreground"> · G{profile.grade}</span> : null}
      </span>
      <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold">
        <Sparkles className="h-3 w-3" />
        {profile.xp}
      </span>
      <span className="bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold">
        <Flame className="h-3 w-3" />
        {profile.streak}
      </span>
      <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-bold uppercase sm:inline ${tierStyles[tier]}`}>
        {tierLabel[tier]}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger className="bg-secondary hover:bg-secondary/80 flex h-8 w-8 items-center justify-center rounded-full">
          <UserIcon className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{profile.full_name ?? "My Account"}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/dashboard">Dashboard</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/onboarding">Edit name & grade</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/pricing">Upgrade plan</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

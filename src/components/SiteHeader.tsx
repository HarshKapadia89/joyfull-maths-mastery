import { Link } from "@tanstack/react-router";
import { Calculator, Home } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UserChip } from "./auth/UserChip";
import { SignInButton } from "./auth/SignInButton";

export function SiteHeader() {
  const { isAuthenticated, loading } = useAuth();
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <Link to={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-2 font-extrabold">
          <span className="bg-gradient-hero flex h-8 w-8 items-center justify-center rounded-xl text-white">
            <Calculator className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">HBK Maths Quest</span>
        </Link>
        <nav className="flex items-center gap-0.5 overflow-x-auto text-sm font-semibold">
          <Link to={isAuthenticated ? "/dashboard" : "/"} className="hover:bg-secondary rounded-lg px-2.5 py-1.5 transition">
            <Home className="inline h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <Link to="/custom" className="hover:bg-secondary rounded-lg px-2.5 py-1.5 transition">Test</Link>
          <Link to="/tutor" className="hover:bg-secondary rounded-lg px-2.5 py-1.5 transition">Tutor</Link>
          <Link to="/worksheet" className="hover:bg-secondary rounded-lg px-2.5 py-1.5 transition">Worksheet</Link>
          <Link to="/revise" className="hover:bg-secondary rounded-lg px-2.5 py-1.5 transition">Revise</Link>
          <Link to="/progress" className="hover:bg-secondary rounded-lg px-2.5 py-1.5 transition">Progress</Link>
          <Link to="/pricing" className="hover:bg-secondary hidden rounded-lg px-2.5 py-1.5 transition md:inline">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2">
          {loading ? null : isAuthenticated ? <UserChip /> : <SignInButton size="sm" label="Sign in" />}
        </div>
      </div>
    </header>
  );
}

import { Link } from "@tanstack/react-router";
import { Calculator, Home } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-extrabold">
          <span className="bg-gradient-hero flex h-8 w-8 items-center justify-center rounded-xl text-white">
            <Calculator className="h-4 w-4" />
          </span>
          <span>HBK Maths Quest</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <Link
            to="/"
            className="hover:bg-secondary rounded-lg px-3 py-1.5 transition"
            activeProps={{ className: "text-primary" }}
            activeOptions={{ exact: true }}
          >
            <Home className="inline h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <Link to="/daily" className="hover:bg-secondary rounded-lg px-3 py-1.5 transition">
            Daily
          </Link>
          <Link to="/tutor" className="hover:bg-secondary rounded-lg px-3 py-1.5 transition">
            Tutor
          </Link>
          <Link to="/custom" className="hover:bg-secondary rounded-lg px-3 py-1.5 transition">
            Custom
          </Link>
          <Link to="/progress" className="hover:bg-secondary rounded-lg px-3 py-1.5 transition">
            Progress
          </Link>
        </nav>
      </div>
    </header>
  );
}

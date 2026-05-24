import { Link } from "@tanstack/react-router";
import { Calculator, Home } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <Link to="/" className="flex items-center gap-2 font-extrabold">
          <span className="bg-gradient-hero flex h-8 w-8 items-center justify-center rounded-xl text-white">
            <Calculator className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">HBK Maths Quest</span>
        </Link>
        <nav className="flex items-center gap-0.5 overflow-x-auto text-sm font-semibold">
          <Link to="/" className="hover:bg-secondary rounded-lg px-2.5 py-1.5 transition" activeProps={{ className: "text-primary" }} activeOptions={{ exact: true }}>
            <Home className="inline h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <Link to="/custom" className="hover:bg-secondary rounded-lg px-2.5 py-1.5 transition">Test</Link>
          <Link to="/tutor" className="hover:bg-secondary rounded-lg px-2.5 py-1.5 transition">Tutor</Link>
          
          <Link to="/worksheet" className="hover:bg-secondary rounded-lg px-2.5 py-1.5 transition">Worksheet</Link>
          <Link to="/revise" className="hover:bg-secondary rounded-lg px-2.5 py-1.5 transition">Revise</Link>
          <Link to="/misconceptions" className="hover:bg-secondary hidden rounded-lg px-2.5 py-1.5 transition md:inline">Patterns</Link>
          <Link to="/progress" className="hover:bg-secondary rounded-lg px-2.5 py-1.5 transition">Progress</Link>
          <Link to="/parent" className="hover:bg-secondary hidden rounded-lg px-2.5 py-1.5 transition md:inline">Parent</Link>
        </nav>
      </div>
    </header>
  );
}

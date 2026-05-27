import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — HBK Maths Quest" },
      { name: "description", content: "Free, Plus, Pro and Family plans for HBK Maths Quest." },
    ],
  }),
  component: Pricing,
});

const tiers = [
  {
    name: "Free",
    price: "₹0",
    blurb: "Practice forever, no card needed.",
    features: ["All 10 grades & chapters", "25 mixed questions per chapter", "Quick Revision PDF", "Daily Problem"],
    cta: "Get started",
    to: "/login",
    highlight: false,
  },
  {
    name: "Plus",
    price: "₹149/mo",
    blurb: "For serious students.",
    features: ["Everything in Free", "Full Revision Pack PDF", "Adaptive daily plan", "Cloud sync across devices"],
    cta: "Coming soon",
    to: "/dashboard",
    highlight: true,
  },
  {
    name: "Pro",
    price: "₹299/mo",
    blurb: "For board / olympiad prep.",
    features: ["Everything in Plus", "Photo Mathy solver", "Mock tests with scoring", "Parent digest weekly"],
    cta: "Coming soon",
    to: "/dashboard",
    highlight: false,
  },
  {
    name: "Family",
    price: "₹499/mo",
    blurb: "Up to 4 children.",
    features: ["Everything in Pro", "Up to 4 student profiles", "Shared parent dashboard"],
    cta: "Coming soon",
    to: "/dashboard",
    highlight: false,
  },
];

function Pricing() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold">Simple, student-friendly pricing</h1>
        <p className="text-muted-foreground mt-2">Start free. Upgrade when you want more.</p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`bg-card shadow-card flex flex-col rounded-2xl p-6 ${
              t.highlight ? "ring-primary ring-2" : ""
            }`}
          >
            <h3 className="text-xl font-extrabold">{t.name}</h3>
            <p className="mt-1 text-3xl font-extrabold">{t.price}</p>
            <p className="text-muted-foreground mt-1 text-sm">{t.blurb}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link
              to={t.to}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold"
            >
              {t.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

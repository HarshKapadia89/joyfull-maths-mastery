import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Check } from "lucide-react";

export const Route = createFileRoute("/billing/success")({
  head: () => ({ meta: [{ title: "Welcome to HBK — Subscription Active" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: BillingSuccess,
});

function BillingSuccess() {
  useEffect(() => {
    const end = Date.now() + 1500;
    const tick = () => {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      if (Date.now() < end) requestAnimationFrame(tick);
    };
    tick();
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="bg-primary/10 text-primary mx-auto flex h-16 w-16 items-center justify-center rounded-full">
        <Check className="h-8 w-8" />
      </div>
      <h1 className="mt-6 text-3xl font-extrabold">You're all set!</h1>
      <p className="text-muted-foreground mt-2">
        Your subscription is active. New features may take a few seconds to unlock.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to="/dashboard"
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-5 py-2 text-sm font-semibold"
        >
          Go to dashboard
        </Link>
        <Link
          to="/pricing"
          className="bg-secondary hover:bg-secondary/80 rounded-md px-5 py-2 text-sm font-semibold"
        >
          View plans
        </Link>
      </div>
    </div>
  );
}

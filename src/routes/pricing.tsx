import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { changeSubscriptionPlan, createPortalSession } from "@/lib/billing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — HBK Maths Quest" },
      { name: "description", content: "Free, Plus, Pro and Family plans for HBK Maths Quest. Save 37% on annual billing." },
    ],
  }),
  component: Pricing,
});

type Interval = "monthly" | "annual";

interface Tier {
  id: "free" | "plus" | "pro" | "family";
  name: string;
  tagline: string;
  monthly: number;
  annual: number;
  monthlyPriceId: string | null;
  annualPriceId: string | null;
  features: string[];
  highlight?: boolean;
}

const tiers: Tier[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Practice forever, no card needed.",
    monthly: 0,
    annual: 0,
    monthlyPriceId: null,
    annualPriceId: null,
    features: [
      "All Concept Cards & Formula Sheets",
      "Quick Revision PDF (view only)",
      "Daily Problem (POTD)",
      "Ask HBK Mathy — 10 questions/day",
      "1 chapter unlocked per grade",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    tagline: "For serious students.",
    monthly: 199,
    annual: 1499,
    monthlyPriceId: "plus_monthly",
    annualPriceId: "plus_annual",
    features: [
      "Everything in Free",
      "All chapters unlocked",
      "Full Revision Pack PDF download",
      "Learning Pathway full lessons",
      "Unlimited text tutor",
    ],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Replace your tuition teacher.",
    monthly: 499,
    annual: 3999,
    monthlyPriceId: "pro_monthly",
    annualPriceId: "pro_annual",
    features: [
      "Everything in Plus",
      "Adaptive Daily Plan",
      "Unlimited photo-question tutor",
      "Full-length mock tests",
      "Weekly parent progress reports",
    ],
  },
  {
    id: "family",
    name: "Family",
    tagline: "Up to 3 children.",
    monthly: 799,
    annual: 5999,
    monthlyPriceId: "family_monthly",
    annualPriceId: "family_annual",
    features: [
      "Everything in Pro",
      "Up to 3 student profiles",
      "Shared parent dashboard",
      "Priority support",
    ],
  },
];

function Pricing() {
  const [interval, setInterval] = useState<Interval>("monthly");
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: profile } = useProfile();
  const { openCheckout, closeCheckout, checkoutElement, isOpen } = useStripeCheckout();

  const currentTier = (profile?.subscription_tier as Tier["id"]) ?? "free";
  const currentInterval = profile?.billing_interval as Interval | null;

  async function handleSelect(tier: Tier) {
    setErrorMsg(null);
    if (tier.id === "free") {
      navigate({ to: isAuthenticated ? "/dashboard" : "/login" });
      return;
    }
    if (!isAuthenticated) {
      navigate({ to: "/login", search: { redirect: "/pricing" } });
      return;
    }
    const priceId = interval === "monthly" ? tier.monthlyPriceId : tier.annualPriceId;
    if (!priceId) return;

    // If already on a paid plan, do a plan change with proration instead of new checkout.
    if (currentTier !== "free") {
      setBusyTier(tier.id);
      const result = await changeSubscriptionPlan({
        data: { newPriceId: priceId, environment: getStripeEnvironment() },
      });
      setBusyTier(null);
      if ("error" in result) {
        setErrorMsg(result.error);
        return;
      }
      navigate({ to: "/billing/success", search: {} });
      return;
    }

    openCheckout({ priceId });
  }

  async function handleManageBilling() {
    setErrorMsg(null);
    setBusyTier("portal");
    const result = await createPortalSession({
      data: { returnUrl: `${window.location.origin}/pricing`, environment: getStripeEnvironment() },
    });
    setBusyTier(null);
    if ("error" in result) {
      setErrorMsg(result.error);
      return;
    }
    window.open(result.url, "_blank");
  }

  return (
    <>
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold">Simple, student-friendly pricing</h1>
          <p className="text-muted-foreground mt-2">
            Start free. Upgrade when you want more.
          </p>

          <div className="bg-secondary mx-auto mt-6 inline-flex rounded-full p-1 text-sm font-semibold">
            <button
              onClick={() => setInterval("monthly")}
              className={`rounded-full px-4 py-1.5 transition ${
                interval === "monthly" ? "bg-background shadow" : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("annual")}
              className={`rounded-full px-4 py-1.5 transition ${
                interval === "annual" ? "bg-background shadow" : "text-muted-foreground"
              }`}
            >
              Annual <span className="text-primary ml-1">Save 37%</span>
            </button>
          </div>

          {isAuthenticated && currentTier !== "free" && (
            <div className="mt-4 text-sm">
              <span className="text-muted-foreground">
                You're on <strong className="text-foreground capitalize">{currentTier}</strong>
                {currentInterval ? ` (${currentInterval})` : ""}.
              </span>{" "}
              <button
                onClick={handleManageBilling}
                disabled={busyTier === "portal"}
                className="text-primary underline"
              >
                Manage billing
              </button>
            </div>
          )}

          {errorMsg && (
            <p className="text-destructive mt-3 text-sm">{errorMsg}</p>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((t) => {
            const isCurrent =
              currentTier === t.id &&
              (t.id === "free" || currentInterval === interval);
            const price = interval === "monthly" ? t.monthly : t.annual;
            const priceLabel =
              t.id === "free"
                ? "₹0"
                : `₹${price.toLocaleString("en-IN")}`;
            const periodLabel =
              t.id === "free" ? "forever" : interval === "monthly" ? "/month" : "/year";

            return (
              <div
                key={t.id}
                className={`bg-card shadow-card relative flex flex-col rounded-2xl p-6 ${
                  t.highlight ? "ring-primary ring-2" : ""
                }`}
              >
                {t.highlight && (
                  <span className="bg-primary text-primary-foreground absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-bold">
                    Most popular
                  </span>
                )}
                <h3 className="text-xl font-extrabold">{t.name}</h3>
                <p className="mt-1">
                  <span className="text-3xl font-extrabold">{priceLabel}</span>
                  <span className="text-muted-foreground text-sm"> {periodLabel}</span>
                </p>
                <p className="text-muted-foreground mt-1 text-sm">{t.tagline}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSelect(t)}
                  disabled={isCurrent || busyTier === t.id}
                  className={`mt-6 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                    isCurrent
                      ? "bg-secondary text-muted-foreground cursor-default"
                      : t.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-foreground text-background hover:opacity-90"
                  }`}
                >
                  {busyTier === t.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isCurrent
                    ? "Current plan"
                    : t.id === "free"
                      ? "Get started"
                      : currentTier !== "free"
                        ? "Switch to this plan"
                        : `Upgrade to ${t.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-muted-foreground mt-8 text-center text-xs">
          Prices in INR. Cancel any time — paid features stay active until the end of your billing period.
          Plan changes are prorated automatically.
        </p>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background relative w-full max-w-2xl rounded-2xl p-4 shadow-2xl">
            <button
              onClick={closeCheckout}
              className="hover:bg-secondary absolute right-3 top-3 z-10 rounded-full p-1.5"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="max-h-[85vh] overflow-y-auto pt-2">{checkoutElement}</div>
          </div>
        </div>
      )}
    </>
  );
}



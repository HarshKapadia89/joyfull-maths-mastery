import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SignInButton } from "./SignInButton";

const DISMISS_KEY = "hbk-guest-banner-dismissed";

export function GuestBanner() {
  const { isAuthenticated, loading } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DISMISS_KEY) === "1";
  });
  if (loading || isAuthenticated || dismissed) return null;
  return (
    <div className="bg-primary/10 border-primary/20 mx-auto mt-3 flex max-w-6xl items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm">
      <p className="text-foreground">
        <span className="font-semibold">Sign in</span> to save your XP, streak and stars across devices.
      </p>
      <div className="flex items-center gap-2">
        <SignInButton size="sm" label="Sign in" />
        <button
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          className="hover:bg-primary/10 rounded p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

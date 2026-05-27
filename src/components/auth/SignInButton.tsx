import { useState } from "react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export function SignInButton({
  redirectTo,
  className,
  label = "Continue with Google",
  size = "default",
}: {
  redirectTo?: string;
  className?: string;
  label?: string;
  size?: "default" | "sm" | "lg";
}) {
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    setLoading(true);
    const target = redirectTo
      ? `${window.location.origin}${redirectTo}`
      : window.location.origin;
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: target,
    });
    if (result.error) {
      toast.error("Sign-in failed. Please try again.");
      setLoading(false);
    }
  };
  return (
    <Button onClick={onClick} disabled={loading} className={className} size={size}>
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M21.35 11.1H12v3.2h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95 0-3.28 2.63-5.95 5.85-5.95 1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.6 3.94 14.5 3 12 3 6.98 3 3 6.98 3 12s3.98 9 9 9c5.2 0 8.65-3.66 8.65-8.8 0-.6-.07-1.05-.15-1.5z"
        />
      </svg>
      {loading ? "Redirecting…" : label}
    </Button>
  );
}

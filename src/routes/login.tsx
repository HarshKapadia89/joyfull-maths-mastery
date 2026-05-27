import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { SignInButton } from "@/components/auth/SignInButton";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — HBK Maths Quest" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || "/dashboard",
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: redirect });
  }, [loading, isAuthenticated, redirect, navigate]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <h1 className="text-3xl font-extrabold">Sign in to HBK Maths Quest</h1>
      <p className="text-muted-foreground mt-2">Save your XP, streak and stars across devices.</p>
      <div className="mt-6 w-full">
        <SignInButton redirectTo={redirect} className="w-full" size="lg" />
      </div>
      <p className="text-muted-foreground mt-6 text-xs">By signing in you agree to our terms.</p>
    </div>
  );
}

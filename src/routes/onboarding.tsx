import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useInvalidateProfile } from "@/hooks/useProfile";
import { updateProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useEffect } from "react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — HBK Maths Quest" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile();
  const update = useServerFn(updateProfile);
  const invalidate = useInvalidateProfile();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<number>(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) navigate({ to: "/login" });
    });
  }, [navigate]);

  useEffect(() => {
    if (profile?.full_name) setName(profile.full_name);
    if (profile?.grade) setGrade(profile.grade);
  }, [profile]);

  if (isLoading) return <div className="p-8 text-center">Loading…</div>;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Please enter your name");
    setSaving(true);
    try {
      await update({ data: { full_name: name.trim(), grade, onboarded: true } });
      await invalidate();
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error("Could not save. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold">Welcome to HBK Maths Quest!</h1>
      <p className="text-muted-foreground mt-2">Just two quick things and you're in.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-semibold">What's your name?</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="mt-1" maxLength={80} />
        </div>
        <div>
          <label className="text-sm font-semibold">Which grade are you in?</label>
          <select
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
            className="border-input bg-background mt-1 h-10 w-full rounded-md border px-3 text-sm"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={saving} className="w-full" size="lg">
          {saving ? "Saving…" : "Start learning"}
        </Button>
      </form>
    </div>
  );
}

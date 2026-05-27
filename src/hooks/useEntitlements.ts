import { useProfile } from "./useProfile";

export type Tier = "guest" | "free" | "plus" | "pro" | "family";

export function useEntitlements() {
  const { data: profile } = useProfile();
  const tier: Tier = !profile ? "guest" : (profile.subscription_tier as Tier);
  const isPaid = tier === "plus" || tier === "pro" || tier === "family";
  const isPro = tier === "pro" || tier === "family";
  return {
    tier,
    isAuthenticated: !!profile,
    canDownloadFullPack: isPaid,
    canUsePhotoSolver: isPro,
    canUseAdaptive: isPaid,
  };
}

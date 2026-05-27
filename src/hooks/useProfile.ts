import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, type ProfileDTO } from "@/lib/profile.functions";
import { useAuth } from "./useAuth";

export function useProfile() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const fetchProfile = useServerFn(getMyProfile);
  const query = useQuery<ProfileDTO>({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
    enabled: isAuthenticated && !authLoading,
    staleTime: 30_000,
  });
  return query;
}

export function useInvalidateProfile() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["profile"] });
}

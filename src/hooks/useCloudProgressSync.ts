import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  mergeLocalProgress,
  updateProgress,
} from "@/lib/profile.functions";
import { loadProgressRaw } from "@/hooks/useProgressStorage";
import { useAuth } from "./useAuth";
import { useProfile } from "./useProfile";

const MIGRATED_KEY = "hbk-cloud-migrated-v1";

/**
 * Wires localStorage progress to the cloud profile:
 *  - one-time max-merge on first login (per device)
 *  - debounced incremental sync on subsequent local changes
 */
export function useCloudProgressSync() {
  const { isAuthenticated, loading } = useAuth();
  const { data: profile } = useProfile();
  const mergeFn = useServerFn(mergeLocalProgress);
  const updateFn = useServerFn(updateProgress);
  const qc = useQueryClient();
  const mergedRef = useRef(false);
  const lastSyncedRef = useRef<string>("");

  // One-time merge
  useEffect(() => {
    if (loading || !isAuthenticated || !profile || mergedRef.current) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(MIGRATED_KEY) === "1") {
      mergedRef.current = true;
      return;
    }
    const local = loadProgressRaw();
    if (!local) {
      localStorage.setItem(MIGRATED_KEY, "1");
      mergedRef.current = true;
      return;
    }
    mergedRef.current = true;
    mergeFn({
      data: {
        xp: local.xp ?? 0,
        streak: local.streak ?? 0,
        problem_stars: local.totalStars ?? 0,
        concept_stars: local.conceptStars ?? 0,
        last_played: local.lastPlayed ?? null,
        chapters: local.chapters ?? {},
      },
    })
      .then(() => {
        localStorage.setItem(MIGRATED_KEY, "1");
        qc.invalidateQueries({ queryKey: ["profile"] });
      })
      .catch((err) => {
        console.error("Cloud merge failed", err);
        mergedRef.current = false;
      });
  }, [loading, isAuthenticated, profile, mergeFn, qc]);

  // Debounced incremental sync on local changes
  useEffect(() => {
    if (!isAuthenticated || !profile) return;
    if (typeof window === "undefined") return;
    let timer: number | undefined;
    const sync = () => {
      const local = loadProgressRaw();
      if (!local) return;
      const sig = `${local.xp}|${local.streak}|${local.totalStars}|${local.conceptStars}|${local.lastPlayed}|${Object.keys(local.chapters || {}).length}`;
      if (sig === lastSyncedRef.current) return;
      lastSyncedRef.current = sig;
      updateFn({
        data: {
          xp: local.xp,
          streak: local.streak,
          problem_stars: local.totalStars,
          concept_stars: local.conceptStars,
          last_active_date: local.lastPlayed ?? null,
          chapters: local.chapters,
        },
      })
        .then(() => qc.invalidateQueries({ queryKey: ["profile"] }))
        .catch((err) => console.error("Progress sync failed", err));
    };
    const onChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(sync, 1200) as unknown as number;
    };
    window.addEventListener("storage", onChange);
    window.addEventListener("hbk-progress-changed", onChange);
    // Initial sync after merge
    onChange();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", onChange);
      window.removeEventListener("hbk-progress-changed", onChange);
    };
  }, [isAuthenticated, profile, updateFn, qc]);
}

# Plan: Authentication, Profiles, Cloud Progress

Based on your answers: **Google OAuth only**, **max-merge** local→cloud on first login, **dedicated marketing landing**, **hybrid gating** (guests can browse + practice; Pro/Plus features locked behind login + paid tier).

---

## 1. Database — single migration

Create `profiles` table (1:1 with `auth.users`) with the columns you listed plus the existing `chapters` JSONB blob so chapter-level stars/attempts also sync.

Columns: `id` (PK + FK→auth.users, ON DELETE CASCADE), `full_name`, `grade` (1–10, CHECK), `phone`, `subscription_tier` (default `'free'`, CHECK in free/plus/pro/family), `subscription_expires_at`, `xp` (default 0), `streak` (default 0), `last_active_date`, `problem_stars` (default 0), `concept_stars` (default 0), `chapters` (JSONB, default `'{}'`), `onboarded` (bool, default false), `created_at`, `updated_at`.

- GRANT SELECT/INSERT/UPDATE on `public.profiles` to `authenticated`; GRANT ALL to `service_role`. No anon grant.
- RLS: users can SELECT/INSERT/UPDATE only their own row (`auth.uid() = id`). No DELETE policy (account deletion handled by cascade).
- Trigger `on_auth_user_created` → auto-insert empty profile row on signup (security definer function `handle_new_user`).
- Trigger `update_profiles_updated_at` for `updated_at`.

## 2. Auth provider setup

- Enable Google via `configure_social_auth(["google"])`.
- Disable email signup explicitly (`disable_signup: false` kept on, but UI only shows Google). Auto-confirm stays off.
- No phone provider work this round.

## 3. Routes (file-based)

**New / changed:**
- `src/routes/index.tsx` → **marketing landing** for guests (hero, "Why HBK", grade tiles teaser, Pricing teaser, "Continue with Google" CTA). For signed-in users, immediately redirect to `/dashboard`.
- `src/routes/dashboard.tsx` → the current home content (HeroBanner / StatTiles / POTD / ModeCards / Grade tiles), now powered by cloud profile.
- `src/routes/login.tsx` → minimal page with Google button + redirect-back via `?redirect=`.
- `src/routes/onboarding.tsx` → 2-question form (name + grade dropdown 1–10). Gated: requires auth, blocks `/dashboard` until `onboarded = true`.
- `src/routes/pricing.tsx` → public; shows Free/Plus/Pro/Family tiers (read-only teaser, no checkout yet).

**Auth flow:**
- `src/routes/__root.tsx` mounts a `<AuthProvider>` + single `onAuthStateChange` listener that invalidates the router + query cache.
- Use TanStack's `_authenticated` pathless layout pattern is **not** applied globally (because gating is hybrid). Instead, individual protected routes (`/dashboard`, `/onboarding`, `/progress`, `/parent`) use `beforeLoad` to check session and redirect to `/login`.

## 4. Hybrid gating

- **Open to guests**: `/`, `/pricing`, `/grade/$gradeId`, `/grade/$gradeId/chapter/$chapterId` (quiz playable), `/tutor` (limited), `/revise`, `/worksheet`, `/flashcards/*`, `/daily`.
- **Login required (free OK)**: `/dashboard`, `/onboarding`, `/progress`, `/parent`, `/mock`.
- **Login + paid tier required**: Full Revision Pack PDF download, photo Mathy, future adaptive plan. Implemented via a single `useEntitlements()` hook returning `{ canDownloadFullPack, canUsePhotoSolver, canUseAdaptive }` based on `subscription_tier`. UI shows a "Pro" lock badge + upsell modal for guests/free users.

Guest banner: small dismissible bar on quiz result screens and on free-tier-only pages — "Sign in with Google to save your XP and streak across devices."

## 5. Top navbar

Replace `SiteHeader.tsx`:
- **Signed in**: logo · existing nav · `<UserChip>` showing `Name · G{grade}` · `⚡{xp}` · `🔥{streak}` · tier badge (Free/Plus/Pro/Family with color) · avatar dropdown (Profile, Logout).
- **Guest**: logo · existing nav · "Sign in" button (Google icon).
- All counters read from `useProfile()` for signed-in users, `useProgress()` (localStorage) for guests, so the chrome works either way.

## 6. Cloud progress sync (`useCloudProgress`)

New hook layered on top of `useProgress`:
- On mount, if `session` exists, fetch profile via server fn `getMyProfile()`.
- One-time **max-merge** when local data exists and cloud `xp === 0` (or a `migrated_at` flag is null): `xp = max(local, cloud)`, same for `streak`, `problem_stars`, `concept_stars`; chapters JSONB merged per-key with max of `best`/`stars`/`attempts`. Persists via server fn `mergeLocalProgress(payload)`. Then sets `localStorage.hbk-migrated = true` so it never re-runs.
- After merge, all writes go to **both** localStorage (for offline + guest fallback) AND a debounced server fn `updateProgress(patch)`.
- `last_active_date` and streak recomputed server-side (security-definer fn `bump_streak()`).

Server functions (all in `src/lib/profile.functions.ts`, all using `requireSupabaseAuth`):
- `getMyProfile()` → row from `profiles`.
- `updateProfile(patch)` → name/grade/onboarded edits.
- `mergeLocalProgress(payload)` → idempotent max-merge.
- `updateProgress(patch)` → debounced incremental writes.

## 7. Onboarding flow

After Google sign-in: `onAuthStateChange` listener checks `profile.onboarded`. If false → router redirect to `/onboarding`. Form posts to `updateProfile({ full_name, grade, onboarded: true })`. Then redirects to `?redirect=` URL or `/dashboard`.

## 8. Files (additive + edits)

**New**
- `src/lib/profile.functions.ts` — server fns above
- `src/hooks/useProfile.ts` — TanStack Query wrapper around `getMyProfile`
- `src/hooks/useCloudProgress.ts` — merge + sync layer
- `src/hooks/useEntitlements.ts` — tier-based feature flags
- `src/components/auth/UserChip.tsx`, `SignInButton.tsx`, `GuestBanner.tsx`, `UpgradeLockBadge.tsx`
- `src/routes/login.tsx`, `src/routes/onboarding.tsx`, `src/routes/dashboard.tsx`, `src/routes/pricing.tsx`
- `src/components/landing/*` — marketing landing sections

**Edited**
- `src/routes/index.tsx` — becomes marketing landing
- `src/routes/__root.tsx` — wire `onAuthStateChange` listener
- `src/components/SiteHeader.tsx` — auth-aware navbar
- `src/components/chapter/ConceptCards.tsx` — Full Pack download gated via `useEntitlements`
- `src/start.ts` — verify `attachSupabaseAuth` is registered (likely already is)

**Not touched**: existing quiz, PDF generation logic, chapter pages, `useProgress` (it remains for guest/offline; the new hook composes on top).

## 9. Out of scope (flagged for later)

- Payments / checkout (Pricing page is teaser only; Stripe or Paddle wiring is a follow-up).
- Phone OTP login (you chose Google-only for now).
- Family plan member management.
- Account deletion UI (cascade works at DB level).

---

## Approval checkpoints during build

Two pauses where I'll need your input:
1. After I write the migration — you approve before it runs.
2. After Google provider is enabled — first sign-in test from you to confirm the redirect lands on `/onboarding`.

Approve to start. I'll begin with the migration, then auth provider config, then UI.

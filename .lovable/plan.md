
# Subscriptions, Paywalls & Dashboard

## Heads-up on Stripe in India
Lovable's built-in Stripe payments don't natively support UPI/netbanking the way Razorpay does — Indian users will mostly pay via card. If UPI is critical, we can swap to Razorpay later. Proceeding with Stripe as you chose.

## 1. Payments (Stripe — Lovable built-in)
- Run `recommend_payment_provider` → `enable_stripe_payments`.
- Create 8 products in Stripe (Plus/Pro/Family × monthly/annual) with INR prices via `batch_create_product`.
- Stripe Checkout flow: server fn `createCheckoutSession({ priceKey })` returns hosted URL.
- Webhook at `/api/public/stripe-webhook` (signature verified) → updates `profiles.subscription_tier`, `subscription_expires_at`, `stripe_customer_id`, `stripe_subscription_id` on `checkout.session.completed`, `customer.subscription.updated/deleted`.
- `/billing/success` page: confetti (canvas-confetti) + "Welcome to {Tier}".
- `manageBilling()` server fn → Stripe customer portal URL for cancel/update card.

## 2. Database (one migration)
Add to `profiles`: `stripe_customer_id text`, `stripe_subscription_id text`, `billing_interval text` (`monthly`/`annual`).

New table `usage_counters`:
- `user_id uuid`, `feature text` (`mathy_text`, `mathy_photo`, `worksheet`), `date date`, `count int default 0`
- PK `(user_id, feature, date)`. RLS: user reads own, writes via SECURITY DEFINER RPC `increment_usage(feature, max_for_tier)` that returns `{allowed, used, limit}` and atomically increments only if under cap.

## 3. Pricing page (rebuild `/pricing`)
- Monthly ↔ Annual toggle (Switch) with "Save ~35%" pill.
- 4-column card grid with feature checklist + per-tier CTA. Mobile = stacked.
- Comparison table below (sticky header row, feature × tier matrix).
- FAQ accordion (refunds, cancel anytime, family sharing).
- CTAs route to checkout (logged-in) or `/login?redirect=/pricing` (guest).

## 4. Entitlements + Soft Paywalls
Extend `useEntitlements` with: `chapterUnlocked(grade, ch)` (always true under new "browsable" model), `canPracticeChapter()` (Free = chapter 1 only of each grade for quiz/practice), `mathyTextLimit`, `mathyPhotoLimit`, `worksheetLimit`, `canUseAdaptive`, `canUseMocks`, `canFreezeStreak`.

New `<PaywallGate feature="..." />` wrapper + `<UpgradeDialog />` modal. Touchpoints:
- **ConceptCards Full Pack**: first download free for guests/free, then blur + upgrade dialog.
- **Quiz/Practice on locked chapter**: lock overlay → `/pricing`.
- **Ask Mathy (`/tutor`)**: call `increment_usage('mathy_text', limit)` before send; on `!allowed` show inline upgrade card.
- **Photo solver**: same with `mathy_photo`, Pro-only past free trial.
- **Worksheet generator (`/worksheet`)**: `increment_usage('worksheet', 5)` for Plus, unlimited for Pro.
- **Mock tests, Misconceptions, Adaptive plan**: route-level Pro gate.

## 5. Sticky upgrade banner
`<UpgradeStickyBanner />` mounted in `__root.tsx`. Shows for `tier === 'free'`, hidden on `/pricing`, `/login`, `/onboarding`, `/billing/*`. Dismiss → `localStorage.upgradeBannerDismissedAt`; reappears after 24h. Copy: "🚀 Upgrade to Pro — Replace your tuition teacher for ₹499/month".

## 6. Dashboard refresh (`/dashboard`)
Reorganized sections:
- Greeting + streak/XP/tier chips
- **Today's Adaptive Daily Plan** card — Pro: 3 suggested tasks from SRS; Free/Plus: blurred preview + "Unlock with Pro".
- **Continue learning** — last chapter (from `chapters` JSONB).
- **Subscription status** — tier badge, expiry date, "Manage billing" (Stripe portal) or "Upgrade".
- Mode cards + grade grid (existing).

## 7. New / edited files
**Created**
- `src/lib/billing.functions.ts` — `createCheckoutSession`, `manageBilling`, `getUsage`.
- `src/lib/usage.functions.ts` — `incrementUsage` (RPC wrapper).
- `src/routes/api/public/stripe-webhook.ts`
- `src/routes/billing.success.tsx`
- `src/components/paywall/UpgradeDialog.tsx`, `PaywallGate.tsx`, `UpgradeStickyBanner.tsx`, `LockedChapterCard.tsx`
- `src/components/dashboard/AdaptivePlanCard.tsx`, `SubscriptionCard.tsx`, `ContinueLearningCard.tsx`
- `src/hooks/useUsage.ts`

**Edited**
- `src/routes/pricing.tsx` (rebuild), `src/routes/dashboard.tsx`, `src/routes/__root.tsx` (mount banner)
- `src/hooks/useEntitlements.ts` (expanded matrix)
- `src/components/chapter/ConceptCards.tsx` (Full Pack gate)
- `src/routes/tutor.tsx`, `src/routes/worksheet.tsx`, `src/routes/mock.tsx`, `src/routes/grade.$gradeId.chapter.$chapterId.tsx` (paywall hooks)

## 8. Approval checkpoints
1. After DB migration runs.
2. After `enable_stripe_payments` + products created — confirm test checkout works.
3. After webhook deploys — test live tier upgrade.

## Out of scope
- Razorpay/UPI (can revisit), prorations on tier switches, family child profiles (we'll store `family_owner_id` on profiles but child invite UX comes later), refunds UI.

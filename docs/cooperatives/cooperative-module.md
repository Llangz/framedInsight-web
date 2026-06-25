# Cooperative Module

This is the feature that distinguishes framedInsight from a generic farm-management app: a coffee cooperative (drawing directly on the founder's own experience as a committee chairman and factory manager at a real Nyeri cooperative) can pre-map its member farmers' plots before those farmers ever sign up themselves, and the platform reconciles ownership once a farmer eventually does. Full RLS mechanics are in `docs/database/rls-policies.md` §6-7; the supply-chain side (factory intake through export) is in `docs/architecture/traceability-architecture.md` and `docs/coffee/coffee-passports.md`. This document covers the cooperative *organization and membership* model specifically.

## 1. Why This Exists (the Operational Problem)

A cooperative field officer mapping member farms doesn't have the luxury of waiting for each farmer to own a smartphone, create an account, and walk their own plot boundary. The officer needs to map hundreds of farmers' plots over a season, regardless of which individual farmers are tech-ready yet. framedInsight's answer: let an officer create a farm record and capture its GPS/plot data immediately, flagged `is_coop_managed = true` with a `claim_token`, and let the actual owner attach themselves to that already-populated record later — at their own pace, on their own phone, whenever they're ready.

## 2. Cooperative Structure

```
cooperatives  (the org itself: name, county, primary_enterprise)
    │
    ├── coop_factories       (washing stations, milk coolers, collection points)
    │
    └── cooperative_officers (admin | officer — who can act on behalf of the coop)
            │
            grants access to →  every farm where farms.managed_by_coop_id = this cooperative
```

The **first officer of a new cooperative is always created as `role = 'admin'`** via `create_cooperative_with_officer` (the cooperative-signup RPC). Additional officers can only be added afterward by an existing admin — `20260625_cooperative_officers_insert_policy.sql` tightened this (see `docs/database/rls-policies.md` §7); before that migration, the only way to add an officer at all was through the signup RPC itself.

## 3. The Officer-Side Mapping Workflow

`app/dashboard/cooperative/farmers/new/` (`MapFarmerClient.tsx`) is where an officer pre-registers a member farmer:

1. Officer enters the farmer's known details — name, phone (if known), location, plot GPS.
2. The action generates a `claim_token` and inserts a `farms` row with `is_coop_managed = true`, `managed_by_coop_id` set to the officer's cooperative, and the generated token attached.
3. Coffee plot/EUDR scaffolding can be created in the same flow (the action also inserts a `coffee_eudr_compliance` row), so a mapped farm arrives with at least placeholder compliance tracking from day one rather than needing a second pass later.
4. The officer can share the resulting claim link/code with the farmer through whatever channel is practical — WhatsApp, SMS, or in person.

This farm is now fully visible and manageable by any officer of the owning cooperative (via `can_manage_farm`'s cooperative-officer branch — see `docs/database/data-dictionary.md` §4), even with zero `farm_managers` rows, because cooperative-officer access doesn't depend on that join table at all.

## 4. The Claim Flow (Farmer-Side)

Two independent paths lead to the same outcome — a `farm_managers` row attaching the real farmer as `owner`, and `claim_token` cleared:

**Path A — explicit claim link** (`/claim/[token]`): a multi-stage client flow (`loading → not_found / already_claimed → confirm → otp → claiming → done`) that looks up the claim by token, confirms the farm details with the farmer, sends an OTP to confirm phone ownership, then calls `claim_cooperative_farm(claim_token, user_id, phone)`. This RPC validates token existence, that it hasn't already been used, and — critically — that the phone completing the claim matches the phone the cooperative originally recorded for that farm (`CLAIM_PHONE_MISMATCH`), so a claim link can't be hijacked by someone other than the intended farmer even if the link itself leaks. See `docs/database/functions-reference.md` §2 for the exact error-code table.

**Path B — normal signup with a matching phone number**: a farmer who was cooperative-mapped might never see or use the explicit claim link at all — they might simply download the app and sign up normally with their phone number. `create_farm_with_manager` (the same RPC used for any individual farmer signup) detects this case itself: if the phone being signed up with matches an existing `is_coop_managed = true, claim_token IS NOT NULL` farm, it transparently claims that farm in place rather than creating a duplicate, with the exact same farmer-already-has-a-manager defensive check as the explicit claim RPC. **This means cooperative-mapped farmers get claimed automatically through the ordinary signup flow, without needing to know a claim link exists at all** — the explicit `/claim/[token]` flow exists for cases where the cooperative wants to proactively notify a specific farmer, not as the only path to claiming.

Both paths lock the candidate row with `FOR UPDATE` before branching, specifically to prevent two concurrent claim attempts (or a claim racing a fresh signup) from both reading "unclaimed" and creating conflicting state.

## 5. What Happens to a Farm After Claiming

`is_coop_managed` **stays `true` permanently** — claiming attaches an owner, it does not detach the farm from the cooperative. After claiming, **both** access paths are live simultaneously: the farmer manages their own farm directly via their new `farm_managers` row, *and* the cooperative's officers retain management access via `managed_by_coop_id`. This is deliberate — a cooperative officer still needs to see a claimed member's coffee data for factory intake, EUDR rollups, and eventual passport assembly, which all operate at cooperative scale regardless of whether the individual farmer has personally claimed their account.

## 6. Cooperative Dashboard Surface

`app/dashboard/cooperative/`: `factories/` (managing `coop_factories` — washing stations etc.), `farmers/` (the mapping workflow above, plus presumably a roster view), `intake/` (factory intake lot / delivery recording — the entry point into the traceability chain, see `docs/architecture/traceability-architecture.md` §1), `eudr/` (cooperative-wide EUDR compliance rollup, likely backed by `cooperative_eudr_summary` — see `docs/database/views-reference.md` §4), `passports/` (passport creation/management — `docs/coffee/coffee-passports.md`).

## 7. Pricing Model — a Note on Scope

A three-tier cooperative pricing strategy (informally: a fully self-service "Digitally Native" tier, a "Bring Your Own Scale" tier for cooperatives with existing weighing infrastructure, and an "Enterprise/Multi-Factory" tier for larger multi-factory cooperatives) has been discussed as the commercial positioning for this module, leading with EUDR compliance as the most urgent buyer-side pitch. **This pricing structure does not currently exist anywhere in the codebase** — it's a business-strategy artifact, not an implemented feature. `lib/tiers.ts` exists and implements a tier system, but it's a different concept entirely: per-*farm* tiering by enterprise size (`smallholder | commercial | enterprise | enterprise_plus`, "highest tier wins" across a multi-enterprise farm's individual enterprise sizes, with multi-enterprise discounting) — it has no cooperative-specific tiers and no reference to the three named cooperative pricing tiers. Don't conflate the two when discussing pricing: `lib/tiers.ts` governs what an individual farm pays based on its size; the cooperative pricing model is a separate, not-yet-coded commercial strategy.